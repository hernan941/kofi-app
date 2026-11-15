import { err, ok, type Result } from '@/shared/domain';

import { entryNameKey, isBackupEntryName, isPrintableAsciiName } from './entry-names';
import {
  CENTRAL_HEADER_SIGNATURE,
  CENTRAL_HEADER_SIZE,
  EOCD_SIGNATURE,
  EOCD_SIZE,
  LOCAL_HEADER_SIGNATURE,
  LOCAL_HEADER_SIZE,
  MAX_NAME_LENGTH,
  SENTINEL_16,
  SENTINEL_32,
  UTF8_FLAG,
  ZIP_VERSION,
  readUint16,
  readUint32,
  viewOf,
  type ZipEntry,
  type ZipFormatError,
  type ZipLimits,
} from './format';

const DATA_JSON = 'data.json';

/** Ubicación del directorio central que declara el EOCD. */
export interface EndOfCentralDirectory {
  readonly cdOffset: number;
  readonly cdSize: number;
  readonly entryCount: number;
}

/** Registro del directorio central validado, con lo que hace falta para comparar con el encabezado local. */
export interface CentralRecord extends ZipEntry {
  readonly versionNeeded: number;
  readonly flags: number;
  readonly nameBytes: Uint8Array;
}

function findCommentedEocd(tail: Uint8Array, view: DataView): boolean {
  for (let position = tail.length - EOCD_SIZE - 1; position >= 0; position -= 1) {
    if (readUint32(view, position) !== EOCD_SIGNATURE) {
      continue;
    }
    const commentLength = readUint16(view, position + 20);
    if (commentLength > 0 && position + EOCD_SIZE + commentLength === tail.length) {
      return true;
    }
  }
  return false;
}

function isUnsupportedEocd(view: DataView, at: number): boolean {
  const disk = readUint16(view, at + 4);
  const cdDisk = readUint16(view, at + 6);
  const onDisk = readUint16(view, at + 8);
  const total = readUint16(view, at + 10);
  return (
    disk !== 0 ||
    cdDisk !== 0 ||
    onDisk !== total ||
    readUint16(view, at + 20) !== 0 ||
    total === SENTINEL_16 ||
    readUint32(view, at + 12) === SENTINEL_32 ||
    readUint32(view, at + 16) === SENTINEL_32
  );
}

/**
 * Localiza y valida el EOCD en `tail` (los últimos bytes del archivo, al menos 22 y hasta 65.557).
 * Exige que esté al final exacto, sin comentario, en un solo disco y sin ZIP64, y que el
 * directorio central termine justo donde empieza el EOCD.
 */
export function parseEndOfCentralDirectory(
  tail: Uint8Array,
  archiveSize: number,
  limits: ZipLimits,
): Result<EndOfCentralDirectory, ZipFormatError> {
  if (archiveSize < EOCD_SIZE || tail.length < EOCD_SIZE) {
    return err('not_a_zip');
  }
  const view = viewOf(tail);
  const at = tail.length - EOCD_SIZE;
  if (readUint32(view, at) !== EOCD_SIGNATURE) {
    return err(findCommentedEocd(tail, view) ? 'unsupported_feature' : 'not_a_zip');
  }
  if (isUnsupportedEocd(view, at)) {
    return err('unsupported_feature');
  }
  const entryCount = readUint16(view, at + 10);
  const cdSize = readUint32(view, at + 12);
  const cdOffset = readUint32(view, at + 16);
  const maxDirectoryBytes = entryCount * (CENTRAL_HEADER_SIZE + MAX_NAME_LENGTH);
  if (entryCount > limits.maxEntries || cdSize > maxDirectoryBytes) {
    return err('too_large');
  }
  if (cdOffset + cdSize !== archiveSize - EOCD_SIZE) {
    return err('out_of_bounds');
  }
  return ok({ cdOffset, cdSize, entryCount });
}

function nameOf(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes);
}

function parseCentralRecord(
  directory: Uint8Array,
  view: DataView,
  position: number,
): Result<{ record: CentralRecord; next: number }, ZipFormatError> {
  if (position + CENTRAL_HEADER_SIZE > directory.length) {
    return err('out_of_bounds');
  }
  if (readUint32(view, position) !== CENTRAL_HEADER_SIGNATURE) {
    return err('out_of_bounds');
  }
  const versionNeeded = readUint16(view, position + 6);
  const flags = readUint16(view, position + 8);
  const method = readUint16(view, position + 10);
  const crc32 = readUint32(view, position + 16);
  const compressedSize = readUint32(view, position + 20);
  const size = readUint32(view, position + 24);
  const nameLength = readUint16(view, position + 28);
  const extraLength = readUint16(view, position + 30);
  const commentLength = readUint16(view, position + 32);
  const diskStart = readUint16(view, position + 34);
  const localHeaderOffset = readUint32(view, position + 42);
  const hasZip64Sentinel = [compressedSize, size, localHeaderOffset].includes(SENTINEL_32);
  if (
    versionNeeded > ZIP_VERSION ||
    (flags & ~UTF8_FLAG) !== 0 ||
    hasZip64Sentinel ||
    extraLength !== 0 ||
    commentLength !== 0 ||
    diskStart !== 0
  ) {
    return err('unsupported_feature');
  }
  if (method !== 0 || compressedSize !== size) {
    return err('compressed_entry');
  }
  const nameStart = position + CENTRAL_HEADER_SIZE;
  if (nameLength === 0 || nameLength > MAX_NAME_LENGTH) {
    return err('invalid_name');
  }
  if (nameStart + nameLength > directory.length) {
    return err('out_of_bounds');
  }
  const nameBytes = directory.slice(nameStart, nameStart + nameLength);
  if (!isPrintableAsciiName(nameBytes)) {
    return err('invalid_name');
  }
  const record: CentralRecord = {
    path: nameOf(nameBytes),
    crc32,
    size,
    localHeaderOffset,
    dataOffset: localHeaderOffset + LOCAL_HEADER_SIZE + nameLength,
    versionNeeded,
    flags,
    nameBytes,
  };
  return ok({ record, next: nameStart + nameLength });
}

function maxBytesFor(path: string, limits: ZipLimits): number {
  return path === DATA_JSON ? limits.maxDataJsonBytes : limits.maxEntryBytes;
}

function checkNamesAndSizes(
  records: readonly CentralRecord[],
  limits: ZipLimits,
): ZipFormatError | null {
  const seen = new Set<string>();
  for (const record of records) {
    const key = entryNameKey(record.path);
    if (seen.has(key)) {
      return 'duplicate_entry';
    }
    seen.add(key);
  }
  if (records.some((record) => !isBackupEntryName(record.path))) {
    return 'invalid_name';
  }
  if (records.some((record) => record.size > maxBytesFor(record.path, limits))) {
    return 'too_large';
  }
  return null;
}

/**
 * Valida el directorio central completo: método 0, tamaños iguales, sin extras ni comentarios,
 * sin ZIP64, nombres ASCII de la lista blanca, sin duplicados (sin distinguir mayúsculas) y
 * tamaños dentro de los límites. Debe ocupar exactamente `directory.length` bytes.
 */
export function parseCentralDirectory(
  directory: Uint8Array,
  entryCount: number,
  limits: ZipLimits,
): Result<readonly CentralRecord[], ZipFormatError> {
  const view = viewOf(directory);
  const records: CentralRecord[] = [];
  let position = 0;
  for (let index = 0; index < entryCount; index += 1) {
    const parsed = parseCentralRecord(directory, view, position);
    if (!parsed.ok) {
      return parsed;
    }
    records.push(parsed.value.record);
    position = parsed.value.next;
  }
  if (position !== directory.length) {
    return err('out_of_bounds');
  }
  const problem = checkNamesAndSizes(records, limits);
  return problem === null ? ok(records) : err(problem);
}

/**
 * Exige que los encabezados y los datos cubran exactamente `[0, cdOffset)`, sin huecos ni solapes:
 * así rechaza bytes escondidos, entradas solapadas y un segundo EOCD.
 */
export function checkLayout(
  entries: readonly ZipEntry[],
  cdOffset: number,
): Result<void, ZipFormatError> {
  if (entries.some((entry) => entry.dataOffset + entry.size > cdOffset)) {
    return err('out_of_bounds');
  }
  const sorted = [...entries].sort((a, b) => a.localHeaderOffset - b.localHeaderOffset);
  let expected = 0;
  for (const entry of sorted) {
    if (entry.localHeaderOffset < expected) {
      return err('overlapping_entries');
    }
    if (entry.localHeaderOffset > expected) {
      return err('out_of_bounds');
    }
    expected = entry.dataOffset + entry.size;
  }
  return expected === cdOffset ? ok(undefined) : err('out_of_bounds');
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

/**
 * Compara el encabezado local (30 bytes más el nombre) con el registro central: firma, versión,
 * flags, método, CRC, tamaños, largo y bytes del nombre.
 */
export function resolveLocalHeader(
  local: Uint8Array,
  record: CentralRecord,
): Result<void, ZipFormatError> {
  const view = viewOf(local);
  if (local.length < LOCAL_HEADER_SIZE + record.nameBytes.length) {
    return err('header_mismatch');
  }
  if (readUint32(view, 0) !== LOCAL_HEADER_SIGNATURE) {
    return err('header_mismatch');
  }
  if (readUint16(view, 28) !== 0) {
    return err('unsupported_feature');
  }
  const matches =
    readUint16(view, 4) === record.versionNeeded &&
    readUint16(view, 6) === record.flags &&
    readUint16(view, 8) === 0 &&
    readUint32(view, 14) === record.crc32 &&
    readUint32(view, 18) === record.size &&
    readUint32(view, 22) === record.size &&
    readUint16(view, 26) === record.nameBytes.length &&
    sameBytes(
      local.subarray(LOCAL_HEADER_SIZE, LOCAL_HEADER_SIZE + record.nameBytes.length),
      record.nameBytes,
    );
  return matches ? ok(undefined) : err('header_mismatch');
}
