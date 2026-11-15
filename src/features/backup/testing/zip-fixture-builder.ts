import { crc32 } from '../domain/zip/crc32';
import { encodeUtf8 } from '../domain/utf8';

/** Campos de un encabezado que un test puede romper. */
export interface HeaderOverrides {
  readonly versionNeeded?: number;
  readonly flags?: number;
  readonly method?: number;
  readonly crc32?: number;
  readonly compressedSize?: number;
  readonly size?: number;
  readonly nameBytes?: Uint8Array;
}

/** Entrada del ZIP a construir; cualquier campo se puede romper en el local, en el central o en ambos. */
export interface ZipEntrySpec extends HeaderOverrides {
  readonly name: string;
  readonly data: Uint8Array;
  readonly local?: HeaderOverrides;
  readonly central?: HeaderOverrides;
  readonly extra?: Uint8Array;
  readonly localExtra?: Uint8Array;
  readonly centralExtra?: Uint8Array;
  readonly centralComment?: Uint8Array;
  readonly diskNumberStart?: number;
  readonly localHeaderOffset?: number;
}

/** Valores del EOCD que se pueden romper. */
export interface EocdOverrides {
  readonly diskNumber?: number;
  readonly cdDisk?: number;
  readonly entriesOnDisk?: number;
  readonly entryCount?: number;
  readonly cdSize?: number;
  readonly cdOffset?: number;
  readonly comment?: Uint8Array;
}

/** Opciones de construcción del archivo completo. */
export interface ZipBuildOptions {
  readonly bytesBeforeFirstEntry?: Uint8Array;
  readonly bytesAfterEachEntry?: Uint8Array;
  readonly bytesBetweenDataAndCentral?: Uint8Array;
  readonly eocd?: EocdOverrides;
  readonly afterEocd?: Uint8Array;
  readonly duplicateEocd?: boolean;
}

const EMPTY = new Uint8Array(0);

function writeHeader(
  view: DataView,
  fields: Required<Omit<HeaderOverrides, 'nameBytes'>>,
  offsets: { versionNeeded: number; flags: number },
): void {
  view.setUint16(offsets.versionNeeded, fields.versionNeeded, true);
  view.setUint16(offsets.flags, fields.flags, true);
  view.setUint16(offsets.flags + 2, fields.method, true);
  view.setUint16(offsets.flags + 4, 0, true);
  view.setUint16(offsets.flags + 6, 0x0021, true);
  view.setUint32(offsets.flags + 8, fields.crc32, true);
  view.setUint32(offsets.flags + 12, fields.compressedSize, true);
  view.setUint32(offsets.flags + 16, fields.size, true);
}

function resolveFields(spec: ZipEntrySpec, scope: HeaderOverrides | undefined) {
  return {
    versionNeeded: scope?.versionNeeded ?? spec.versionNeeded ?? 20,
    flags: scope?.flags ?? spec.flags ?? 0x0800,
    method: scope?.method ?? spec.method ?? 0,
    crc32: scope?.crc32 ?? spec.crc32 ?? crc32(0, spec.data),
    compressedSize: scope?.compressedSize ?? spec.compressedSize ?? spec.data.length,
    size: scope?.size ?? spec.size ?? spec.data.length,
  };
}

function nameBytesOf(spec: ZipEntrySpec, scope: HeaderOverrides | undefined): Uint8Array {
  return scope?.nameBytes ?? spec.nameBytes ?? encodeUtf8(spec.name);
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function localRecord(spec: ZipEntrySpec): Uint8Array {
  const name = nameBytesOf(spec, spec.local);
  const extra = spec.localExtra ?? spec.extra ?? EMPTY;
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  writeHeader(view, resolveFields(spec, spec.local), { versionNeeded: 4, flags: 6 });
  view.setUint16(26, name.length, true);
  view.setUint16(28, extra.length, true);
  return concat([header, name, extra]);
}

function centralRecord(spec: ZipEntrySpec, localOffset: number): Uint8Array {
  const name = nameBytesOf(spec, spec.central);
  const extra = spec.centralExtra ?? spec.extra ?? EMPTY;
  const comment = spec.centralComment ?? EMPTY;
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  writeHeader(view, resolveFields(spec, spec.central), { versionNeeded: 6, flags: 8 });
  view.setUint16(28, name.length, true);
  view.setUint16(30, extra.length, true);
  view.setUint16(32, comment.length, true);
  view.setUint16(34, spec.diskNumberStart ?? 0, true);
  view.setUint32(42, spec.localHeaderOffset ?? localOffset, true);
  return concat([header, name, extra, comment]);
}

function eocdRecord(
  entryCount: number,
  cdSize: number,
  cdOffset: number,
  overrides: EocdOverrides | undefined,
): Uint8Array {
  const comment = overrides?.comment ?? EMPTY;
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, overrides?.diskNumber ?? 0, true);
  view.setUint16(6, overrides?.cdDisk ?? 0, true);
  view.setUint16(8, overrides?.entriesOnDisk ?? entryCount, true);
  view.setUint16(10, overrides?.entryCount ?? entryCount, true);
  view.setUint32(12, overrides?.cdSize ?? cdSize, true);
  view.setUint32(16, overrides?.cdOffset ?? cdOffset, true);
  view.setUint16(20, comment.length, true);
  return concat([record, comment]);
}

/**
 * Construye un ZIP STORED para los tests y deja romper cualquier campo: método, flags, tamaños,
 * CRC, offsets, extras, comentarios, huecos entre entradas, un EOCD duplicado o bytes al final.
 * Sin opciones produce exactamente lo que el escritor propio del dominio.
 */
export function buildZip(
  entries: readonly ZipEntrySpec[],
  options: ZipBuildOptions = {},
): Uint8Array {
  const parts: Uint8Array[] = [options.bytesBeforeFirstEntry ?? EMPTY];
  const offsets: number[] = [];
  let position = parts[0]?.length ?? 0;
  for (const spec of entries) {
    const local = localRecord(spec);
    offsets.push(position);
    const gap = options.bytesAfterEachEntry ?? EMPTY;
    parts.push(local, spec.data, gap);
    position += local.length + spec.data.length + gap.length;
  }
  const between = options.bytesBetweenDataAndCentral ?? EMPTY;
  parts.push(between);
  position += between.length;
  const central = concat(entries.map((spec, index) => centralRecord(spec, offsets[index] ?? 0)));
  const eocd = eocdRecord(entries.length, central.length, position, options.eocd);
  parts.push(central, eocd);
  if (options.duplicateEocd === true) {
    parts.push(eocd);
  }
  parts.push(options.afterEocd ?? EMPTY);
  return concat(parts);
}

/** Entrada con texto UTF-8, atajo para `manifest.json` y `data.json`. */
export function textEntry(name: string, text: string): ZipEntrySpec {
  return { name, data: encodeUtf8(text) };
}
