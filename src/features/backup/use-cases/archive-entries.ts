import type { ArchiveEntryInput } from '../domain/zip/archive';
import type { ArchiveIo } from '../domain/ports';

/** Entrada del ZIP con bytes que ya están en memoria. */
export function bytesEntry(path: string, bytes: Uint8Array): ArchiveEntryInput {
  return {
    path,
    size: bytes.length,
    readRange: (offset, length) => Promise.resolve(bytes.subarray(offset, offset + length)),
  };
}

/**
 * Entrada del ZIP que lee un archivo del disco. Abre y cierra el archivo en cada lectura, así
 * nunca hay más de un archivo abierto y una falla de lectura no deja un handle suelto.
 */
export function fileEntry(
  io: ArchiveIo,
  path: string,
  uri: string,
  size: number,
): ArchiveEntryInput {
  return {
    path,
    size,
    readRange: async (offset, length) => {
      const file = await io.openForRead(uri);
      try {
        return await file.read(offset, length);
      } finally {
        file.close();
      }
    },
  };
}

/** Tamaño de un archivo del disco. */
export async function sizeOfFile(io: ArchiveIo, uri: string): Promise<number> {
  const file = await io.openForRead(uri);
  try {
    return file.size;
  } finally {
    file.close();
  }
}
