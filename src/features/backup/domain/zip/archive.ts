import { err, ok, type Result } from '@/shared/domain';

import type { RandomAccessFile, SequentialWriter } from '../ports';
import { crc32 } from './crc32';
import { entryNameKey, isSafeEntryName } from './entry-names';
import {
  BACKUP_ZIP_LIMITS,
  EOCD_SIZE,
  MAX_WRITABLE_ENTRIES,
  SENTINEL_32,
  type ZipEntry,
  type ZipFormatError,
  type ZipLimits,
} from './format';
import {
  checkLayout,
  parseCentralDirectory,
  parseEndOfCentralDirectory,
  resolveLocalHeader,
} from './reader';
import { encodeCentralDirectory, encodeLocalHeader } from './writer';

const MAX_COMMENT_BYTES = 0xffff;
const COPY_BLOCK_BYTES = 1_048_576;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * CRC32 de bytes que ya están en memoria, por bloques de 1 MiB, cediendo el hilo de JS entre un
 * bloque y el siguiente para que la UI no se congele con una entrada grande.
 */
async function checksumInBlocks(bytes: Uint8Array): Promise<number> {
  let checksum = 0;
  for (let position = 0; position < bytes.length; position += COPY_BLOCK_BYTES) {
    if (position > 0) {
      await yieldToEventLoop();
    }
    checksum = crc32(checksum, bytes.subarray(position, position + COPY_BLOCK_BYTES));
  }
  return checksum;
}

/** Archivo validado: entradas por nombre y offset del directorio central. */
export interface StoredArchive {
  readonly size: number;
  readonly cdOffset: number;
  readonly entries: ReadonlyMap<string, ZipEntry>;
}

async function readEndOfCentralDirectory(file: RandomAccessFile, limits: ZipLimits) {
  const exact = await file.read(file.size - EOCD_SIZE, EOCD_SIZE);
  const parsed = parseEndOfCentralDirectory(exact, file.size, limits);
  if (parsed.ok || parsed.error !== 'not_a_zip' || file.size === EOCD_SIZE) {
    return parsed;
  }
  const tailLength = Math.min(file.size, EOCD_SIZE + MAX_COMMENT_BYTES);
  const tail = await file.read(file.size - tailLength, tailLength);
  return parseEndOfCentralDirectory(tail, file.size, limits);
}

/**
 * Lee el EOCD (últimos bytes), el directorio central y cada encabezado local, y aplica
 * `checkLayout`. No lee datos de las entradas.
 */
export async function openStoredArchive(
  file: RandomAccessFile,
  limits: ZipLimits,
): Promise<Result<StoredArchive, ZipFormatError>> {
  if (file.size < EOCD_SIZE) {
    return err('not_a_zip');
  }
  if (file.size > limits.maxArchiveBytes) {
    return err('too_large');
  }
  const eocd = await readEndOfCentralDirectory(file, limits);
  if (!eocd.ok) {
    return eocd;
  }
  const { cdOffset, cdSize, entryCount } = eocd.value;
  const directory = cdSize === 0 ? new Uint8Array(0) : await file.read(cdOffset, cdSize);
  const records = parseCentralDirectory(directory, entryCount, limits);
  if (!records.ok) {
    return records;
  }
  const layout = checkLayout(records.value, cdOffset);
  if (!layout.ok) {
    return layout;
  }
  for (const record of records.value) {
    const local = await file.read(
      record.localHeaderOffset,
      record.dataOffset - record.localHeaderOffset,
    );
    const resolved = resolveLocalHeader(local, record);
    if (!resolved.ok) {
      return resolved;
    }
  }
  const entries = new Map<string, ZipEntry>(
    records.value.map(({ path, crc32: crc, size, localHeaderOffset, dataOffset }) => [
      path,
      { path, crc32: crc, size, localHeaderOffset, dataOffset },
    ]),
  );
  return ok({ size: file.size, cdOffset, entries });
}

/**
 * Lee una entrada chica completa y compara su CRC32, calculado por bloques de 1 MiB que ceden
 * el hilo de JS entre sí.
 */
export async function readVerifiedEntry(
  file: RandomAccessFile,
  entry: ZipEntry,
): Promise<Result<Uint8Array, { readonly code: 'checksum_mismatch'; readonly path: string }>> {
  const bytes = await file.read(entry.dataOffset, entry.size);
  if ((await checksumInBlocks(bytes)) !== entry.crc32) {
    return err({ code: 'checksum_mismatch', path: entry.path });
  }
  return ok(bytes);
}

/** Entrada a escribir; `readRange` lee su contenido (bytes en memoria o un archivo). */
export interface ArchiveEntryInput {
  readonly path: string;
  readonly size: number;
  readRange(offset: number, length: number): Promise<Uint8Array>;
}

/** Motivo por el que el escritor rechaza una entrada o un archivo. */
export type ZipWriteErrorCode =
  'invalid_name' | 'duplicate_entry' | 'too_many_entries' | 'too_large' | 'short_read';

/** Error de programación del escritor; la exportación valida antes con `BACKUP_ZIP_LIMITS`. */
export class ZipWriteError extends Error {
  constructor(
    readonly code: ZipWriteErrorCode,
    readonly path?: string,
  ) {
    super(path === undefined ? code : `${code}: ${path}`);
    this.name = 'ZipWriteError';
  }
}

function validateInputs(entries: readonly ArchiveEntryInput[]): void {
  if (entries.length > MAX_WRITABLE_ENTRIES) {
    throw new ZipWriteError('too_many_entries');
  }
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!isSafeEntryName(entry.path)) {
      throw new ZipWriteError('invalid_name', entry.path);
    }
    const key = entryNameKey(entry.path);
    if (seen.has(key)) {
      throw new ZipWriteError('duplicate_entry', entry.path);
    }
    seen.add(key);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size >= SENTINEL_32) {
      throw new ZipWriteError('too_large', entry.path);
    }
  }
}

async function readExactly(
  entry: ArchiveEntryInput,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  const bytes = await entry.readRange(offset, length);
  if (bytes.length !== length) {
    throw new ZipWriteError('short_read', entry.path);
  }
  return bytes;
}

async function writeSmallEntry(
  writer: SequentialWriter,
  entry: ArchiveEntryInput,
  offset: number,
): Promise<ZipEntry> {
  const bytes = await readExactly(entry, 0, entry.size);
  const checksum = await checksumInBlocks(bytes);
  const header = encodeLocalHeader(entry.path, checksum, entry.size);
  await writer.write(header);
  await writer.write(bytes);
  return toZipEntry(entry, checksum, offset, header.length);
}

async function writeLargeEntry(
  writer: SequentialWriter,
  entry: ArchiveEntryInput,
  offset: number,
): Promise<ZipEntry> {
  let checksum = 0;
  for (let position = 0; position < entry.size; position += COPY_BLOCK_BYTES) {
    const length = Math.min(COPY_BLOCK_BYTES, entry.size - position);
    checksum = crc32(checksum, await readExactly(entry, position, length));
    await yieldToEventLoop();
  }
  const header = encodeLocalHeader(entry.path, checksum, entry.size);
  await writer.write(header);
  for (let position = 0; position < entry.size; position += COPY_BLOCK_BYTES) {
    const length = Math.min(COPY_BLOCK_BYTES, entry.size - position);
    await writer.write(await readExactly(entry, position, length));
  }
  return toZipEntry(entry, checksum, offset, header.length);
}

function toZipEntry(
  entry: ArchiveEntryInput,
  checksum: number,
  offset: number,
  headerLength: number,
): ZipEntry {
  return {
    path: entry.path,
    crc32: checksum,
    size: entry.size,
    localHeaderOffset: offset,
    dataOffset: offset + headerLength,
  };
}

/**
 * Escribe el ZIP STORED en orden. Una entrada de hasta `maxEntryBytes` (16 MiB) se lee completa
 * una vez. Una más grande (solo la base de la exportación de emergencia) se lee dos veces por
 * bloques de 1 MiB: la primera para el CRC32 y la segunda para copiar. Siempre calcula el CRC32 por
 * bloques de 1 MiB, cediendo el hilo de JS entre un bloque y el siguiente.
 * @throws {ZipWriteError} Nombre inseguro o repetido, demasiadas entradas, tamaño o offset que
 * exigiría ZIP64, o un `readRange` que devuelve otra cantidad de bytes.
 */
export async function writeStoredArchive(
  writer: SequentialWriter,
  entries: readonly ArchiveEntryInput[],
  onEntryWritten?: (done: number, total: number) => void,
): Promise<readonly ZipEntry[]> {
  validateInputs(entries);
  const written: ZipEntry[] = [];
  for (const entry of entries) {
    const offset = writer.position;
    if (offset >= SENTINEL_32) {
      throw new ZipWriteError('too_large', entry.path);
    }
    const isSmall = entry.size <= BACKUP_ZIP_LIMITS.maxEntryBytes;
    written.push(
      isSmall
        ? await writeSmallEntry(writer, entry, offset)
        : await writeLargeEntry(writer, entry, offset),
    );
    onEntryWritten?.(written.length, entries.length);
  }
  const cdOffset = writer.position;
  if (cdOffset >= SENTINEL_32) {
    throw new ZipWriteError('too_large');
  }
  await writer.write(encodeCentralDirectory(written, cdOffset));
  return written;
}
