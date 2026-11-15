import { crc32 } from '../zip/crc32';
import {
  LOCAL_HEADER_SIGNATURE,
  LOCAL_HEADER_SIZE,
  readUint16,
  readUint32,
  viewOf,
} from '../zip/format';
import { decodeUtf8Strict } from '../utf8';
import type { RandomAccessFile } from '../ports';

const INFO_ENTRY_NAME = 'info.json';
const EMERGENCY_KIND = 'cuantovendi-emergency';
const MAX_INFO_BYTES = 4096;

async function readInfo(file: RandomAccessFile): Promise<string | null> {
  const nameLength = INFO_ENTRY_NAME.length;
  if (file.size < LOCAL_HEADER_SIZE + nameLength) {
    return null;
  }
  const header = await file.read(0, LOCAL_HEADER_SIZE + nameLength);
  const view = viewOf(header);
  const name = decodeUtf8Strict(header.subarray(LOCAL_HEADER_SIZE));
  const size = readUint32(view, 22);
  const fits = LOCAL_HEADER_SIZE + nameLength + size <= file.size;
  const isInfoEntry =
    readUint32(view, 0) === LOCAL_HEADER_SIGNATURE &&
    readUint16(view, 8) === 0 &&
    readUint16(view, 26) === nameLength &&
    readUint16(view, 28) === 0 &&
    name.ok &&
    name.value === INFO_ENTRY_NAME;
  if (!isInfoEntry || size > MAX_INFO_BYTES || !fits) {
    return null;
  }
  const data = await file.read(LOCAL_HEADER_SIZE + nameLength, size);
  if (crc32(0, data) !== readUint32(view, 14)) {
    return null;
  }
  const text = decodeUtf8Strict(data);
  return text.ok ? text.value : null;
}

/**
 * Indica si el archivo es una copia de emergencia (ADR-006, F8.8): el escritor siempre pone
 * `info.json` primero, así que basta leer el primer encabezado local y comprobar que su
 * contenido declara `kind: "cuantovendi-emergency"`. No valida el resto del archivo: la
 * restauración no soporta esas copias y solo necesita nombrarlas bien.
 */
export async function isEmergencyArchive(file: RandomAccessFile): Promise<boolean> {
  const text = await readInfo(file);
  if (text === null) {
    return false;
  }
  try {
    const info: unknown = JSON.parse(text);
    return (
      typeof info === 'object' &&
      info !== null &&
      (info as { kind?: unknown }).kind === EMERGENCY_KIND
    );
  } catch {
    return false;
  }
}
