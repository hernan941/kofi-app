import { digest, CryptoDigestAlgorithm } from 'expo-crypto';
import { File, FileMode, Paths, type FileHandle } from 'expo-file-system';

import type { ArchiveIo, RandomAccessFile, SequentialWriter } from '../domain/ports';

const COPY_BLOCK_BYTES = 1_048_576;
const HEX_RADIX = 16;
const BYTE_HEX_WIDTH = 2;

/**
 * Ejecuta las operaciones de un handle una tras otra: `FileHandle` no ordena las operaciones
 * asíncronas (el `offset` es compartido), así que dos lecturas a la vez se pisarían.
 */
function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);
    tail = result.catch(() => undefined);
    return result;
  };
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(HEX_RADIX).padStart(BYTE_HEX_WIDTH, '0'),
  ).join('');
}

function isArrayBufferBacked(bytes: Uint8Array): bytes is Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer;
}

function closeOnce(handle: FileHandle): () => void {
  let closed = false;
  return () => {
    if (!closed) {
      closed = true;
      handle.close();
    }
  };
}

/**
 * Lee `length` bytes desde `offset`. `readBytes` puede devolver menos de lo pedido sin que sea el
 * final del archivo, así que repite desde donde quedó y falla solo si una lectura vuelve vacía
 * (EOF) antes de completar.
 */
async function readFully(handle: FileHandle, offset: number, length: number): Promise<Uint8Array> {
  handle.offset = offset;
  const first = await handle.readBytes(length);
  if (first.length === length) {
    return first;
  }
  const result = new Uint8Array(length);
  result.set(first, 0);
  let filled = first.length;
  while (filled < length) {
    handle.offset = offset + filled;
    const chunk = await handle.readBytes(length - filled);
    if (chunk.length === 0) {
      throw new RangeError(
        `Expected ${String(length)} bytes at ${String(offset)} but the file ends after ${String(filled)}.`,
      );
    }
    result.set(chunk, filled);
    filled += chunk.length;
  }
  return result;
}

function createRandomAccessFile(uri: string): RandomAccessFile {
  const handle = new File(uri).open(FileMode.ReadOnly);
  const size = handle.size ?? 0;
  const enqueue = createSerialQueue();
  return {
    size,
    read: (offset, length) =>
      enqueue(async () => {
        if (length === 0) {
          return new Uint8Array(0);
        }
        return readFully(handle, offset, length);
      }),
    close: closeOnce(handle),
  };
}

function createSequentialWriter(uri: string): SequentialWriter {
  const file = new File(uri);
  file.parentDirectory.create({ idempotent: true, intermediates: true });
  file.create({ overwrite: true, intermediates: true });
  const handle = file.open(FileMode.Truncate);
  const enqueue = createSerialQueue();
  let position = 0;
  return {
    get position() {
      return position;
    },
    write: (bytes) =>
      enqueue(async () => {
        await handle.writeBytes(bytes);
        position += bytes.length;
      }),
    close: closeOnce(handle),
  };
}

async function copyBlocks(
  source: RandomAccessFile,
  offset: number,
  length: number,
  writer: SequentialWriter,
): Promise<void> {
  for (let copied = 0; copied < length; copied += COPY_BLOCK_BYTES) {
    const block = Math.min(COPY_BLOCK_BYTES, length - copied);
    await writer.write(await source.read(offset + copied, block));
  }
}

/**
 * Adaptador delgado de `ArchiveIo` sobre `FileHandle` de `expo-file-system`, `File.digest`,
 * `expo-crypto` y `Paths.availableDiskSpace` (ADR-012). No decide rutas: escribe donde se le
 * indica, y quien llama las deriva de ids validados.
 */
export function createExpoArchiveIo(): ArchiveIo {
  return {
    openForRead: (uri) => Promise.resolve().then(() => createRandomAccessFile(uri)),
    createForWrite: (uri) => Promise.resolve().then(() => createSequentialWriter(uri)),
    copyRange: async (source, offset, length, targetUri) => {
      const writer = createSequentialWriter(targetUri);
      try {
        await copyBlocks(source, offset, length, writer);
      } finally {
        writer.close();
      }
    },
    sha256OfFile: async (uri) => (await new File(uri).digest('SHA-256')).toLowerCase(),
    sha256OfBytes: async (bytes) =>
      toHex(
        await digest(
          CryptoDigestAlgorithm.SHA256,
          isArrayBufferBacked(bytes) ? bytes : bytes.slice(),
        ),
      ),
    availableDiskSpace: () => Paths.availableDiskSpace,
  };
}
