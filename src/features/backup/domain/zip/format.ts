/** Firma del encabezado local (`PK\x03\x04`). */
export const LOCAL_HEADER_SIGNATURE = 0x04034b50;
/** Firma del directorio central (`PK\x01\x02`). */
export const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
/** Firma del fin del directorio central (`PK\x05\x06`). */
export const EOCD_SIGNATURE = 0x06054b50;

/** Tamaño fijo del encabezado local, sin el nombre. */
export const LOCAL_HEADER_SIZE = 30;
/** Tamaño fijo del registro del directorio central, sin el nombre. */
export const CENTRAL_HEADER_SIZE = 46;
/** Tamaño del EOCD sin comentario. */
export const EOCD_SIZE = 22;
/** Largo máximo del nombre de una entrada. */
export const MAX_NAME_LENGTH = 255;

/** Versión necesaria que escribe el escritor y la máxima que acepta el lector. */
export const ZIP_VERSION = 20;
/** Bit 11: nombres en UTF-8; el único flag permitido. */
export const UTF8_FLAG = 0x0800;
/** Hora DOS fija (determinismo). */
export const DOS_TIME = 0;
/** Fecha DOS fija: 1980-01-01. */
export const DOS_DATE = 0x0021;

/** Centinela de 16 bits de ZIP64. */
export const SENTINEL_16 = 0xffff;
/** Centinela de 32 bits de ZIP64. */
export const SENTINEL_32 = 0xffffffff;
/** Máximo de entradas que el escritor admite sin ZIP64. */
export const MAX_WRITABLE_ENTRIES = 0xfffe;

/** Errores de formato del lector, sin E/S (ADR-012). */
export type ZipFormatError =
  | 'not_a_zip'
  | 'unsupported_feature'
  | 'compressed_entry'
  | 'invalid_name'
  | 'duplicate_entry'
  | 'overlapping_entries'
  | 'out_of_bounds'
  | 'header_mismatch'
  | 'too_large';

/** Entrada del directorio central ya validada. */
export interface ZipEntry {
  readonly path: string;
  readonly crc32: number;
  readonly size: number;
  readonly localHeaderOffset: number;
  readonly dataOffset: number;
}

/** Límites que el lector aplica antes de leer datos. */
export interface ZipLimits {
  readonly maxArchiveBytes: number;
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxDataJsonBytes: number;
}

/** Límites de la v1: el mismo conjunto se aplica al exportar y al restaurar (backup.md, 3.2). */
export const BACKUP_ZIP_LIMITS: ZipLimits = {
  maxArchiveBytes: 2_147_483_647,
  maxEntries: 20_002,
  maxEntryBytes: 16_777_216,
  maxDataJsonBytes: 33_554_432,
};

/** Lee un entero de 16 bits *little-endian*. */
export function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

/** Lee un entero de 32 bits *little-endian*. */
export function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/** Escribe un entero de 16 bits *little-endian*. */
export function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

/** Escribe un entero de 32 bits *little-endian*. */
export function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true);
}

/** Vista sobre exactamente los bytes del arreglo (que puede ser un `subarray`). */
export function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
