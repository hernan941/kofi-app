import { encodeUtf8 } from '../utf8';
import {
  CENTRAL_HEADER_SIGNATURE,
  CENTRAL_HEADER_SIZE,
  DOS_DATE,
  DOS_TIME,
  EOCD_SIGNATURE,
  EOCD_SIZE,
  LOCAL_HEADER_SIGNATURE,
  LOCAL_HEADER_SIZE,
  UTF8_FLAG,
  ZIP_VERSION,
  viewOf,
  writeUint16,
  writeUint32,
  type ZipEntry,
} from './format';

/** Encabezado local (30 bytes más el nombre) de una entrada STORED con fechas DOS fijas. */
export function encodeLocalHeader(path: string, crc32: number, size: number): Uint8Array {
  const name = encodeUtf8(path);
  const bytes = new Uint8Array(LOCAL_HEADER_SIZE + name.length);
  const view = viewOf(bytes);
  writeUint32(view, 0, LOCAL_HEADER_SIGNATURE);
  writeUint16(view, 4, ZIP_VERSION);
  writeUint16(view, 6, UTF8_FLAG);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, DOS_TIME);
  writeUint16(view, 12, DOS_DATE);
  writeUint32(view, 14, crc32);
  writeUint32(view, 18, size);
  writeUint32(view, 22, size);
  writeUint16(view, 26, name.length);
  writeUint16(view, 28, 0);
  bytes.set(name, LOCAL_HEADER_SIZE);
  return bytes;
}

function encodeCentralRecord(entry: ZipEntry): Uint8Array {
  const name = encodeUtf8(entry.path);
  const bytes = new Uint8Array(CENTRAL_HEADER_SIZE + name.length);
  const view = viewOf(bytes);
  writeUint32(view, 0, CENTRAL_HEADER_SIGNATURE);
  writeUint16(view, 4, ZIP_VERSION);
  writeUint16(view, 6, ZIP_VERSION);
  writeUint16(view, 8, UTF8_FLAG);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, DOS_TIME);
  writeUint16(view, 14, DOS_DATE);
  writeUint32(view, 16, entry.crc32);
  writeUint32(view, 20, entry.size);
  writeUint32(view, 24, entry.size);
  writeUint16(view, 28, name.length);
  writeUint32(view, 42, entry.localHeaderOffset);
  bytes.set(name, CENTRAL_HEADER_SIZE);
  return bytes;
}

/** Directorio central seguido del EOCD, sin comentario; `cdOffset` es donde empieza el directorio. */
export function encodeCentralDirectory(entries: readonly ZipEntry[], cdOffset: number): Uint8Array {
  const records = entries.map(encodeCentralRecord);
  const cdSize = records.reduce((total, record) => total + record.length, 0);
  const bytes = new Uint8Array(cdSize + EOCD_SIZE);
  let position = 0;
  for (const record of records) {
    bytes.set(record, position);
    position += record.length;
  }
  const view = viewOf(bytes);
  writeUint32(view, position, EOCD_SIGNATURE);
  writeUint16(view, position + 8, entries.length);
  writeUint16(view, position + 10, entries.length);
  writeUint32(view, position + 12, cdSize);
  writeUint32(view, position + 16, cdOffset);
  return bytes;
}
