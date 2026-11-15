import { err, ok, type Result } from '@/shared/domain';

const REPLACEMENT = 0xfffd;
const CHUNK_SIZE = 8192;

function isHighSurrogate(unit: number): boolean {
  return unit >= 0xd800 && unit <= 0xdbff;
}

function isLowSurrogate(unit: number): boolean {
  return unit >= 0xdc00 && unit <= 0xdfff;
}

function codePointAt(text: string, index: number): number {
  const unit = text.charCodeAt(index);
  if (isHighSurrogate(unit)) {
    const next = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
    return isLowSurrogate(next) ? 0x10000 + ((unit - 0xd800) << 10) + (next - 0xdc00) : REPLACEMENT;
  }
  return isLowSurrogate(unit) ? REPLACEMENT : unit;
}

function utf8Length(text: string): number {
  let length = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) {
      length += 1;
    } else if (unit < 0x800) {
      length += 2;
    } else if (isHighSurrogate(unit) && isLowSurrogate(text.charCodeAt(index + 1))) {
      length += 4;
      index += 1;
    } else {
      length += 3;
    }
  }
  return length;
}

/**
 * Codifica texto como UTF-8; un sustituto suelto se codifica como U+FFFD, igual que `TextEncoder`.
 * Calcula el tamaño en una primera pasada y escribe en la segunda, así reserva exactamente lo
 * que ocupa el resultado (sin `length × 3` ni una copia final). Los dos bucles tratan el ASCII sin
 * llamar a otra función porque Hermes no tiene JIT.
 */
export function encodeUtf8(text: string): Uint8Array {
  const out = new Uint8Array(utf8Length(text));
  let length = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) {
      out[length] = unit;
      length += 1;
      continue;
    }
    const codePoint = codePointAt(text, index);
    length = writeCodePoint(out, length, codePoint);
    index += codePoint >= 0x10000 ? 1 : 0;
  }
  return out;
}

function writeCodePoint(out: Uint8Array, at: number, codePoint: number): number {
  if (codePoint < 0x80) {
    out[at] = codePoint;
    return at + 1;
  }
  if (codePoint < 0x800) {
    out[at] = 0xc0 | (codePoint >> 6);
    out[at + 1] = 0x80 | (codePoint & 0x3f);
    return at + 2;
  }
  if (codePoint < 0x10000) {
    out[at] = 0xe0 | (codePoint >> 12);
    out[at + 1] = 0x80 | ((codePoint >> 6) & 0x3f);
    out[at + 2] = 0x80 | (codePoint & 0x3f);
    return at + 3;
  }
  out[at] = 0xf0 | (codePoint >> 18);
  out[at + 1] = 0x80 | ((codePoint >> 12) & 0x3f);
  out[at + 2] = 0x80 | ((codePoint >> 6) & 0x3f);
  out[at + 3] = 0x80 | (codePoint & 0x3f);
  return at + 4;
}

interface SequenceShape {
  readonly extraBytes: number;
  readonly minCodePoint: number;
  readonly leadBits: number;
}

function shapeOf(lead: number): SequenceShape | null {
  if (lead >= 0xc2 && lead <= 0xdf) {
    return { extraBytes: 1, minCodePoint: 0x80, leadBits: lead & 0x1f };
  }
  if (lead >= 0xe0 && lead <= 0xef) {
    return { extraBytes: 2, minCodePoint: 0x800, leadBits: lead & 0x0f };
  }
  if (lead >= 0xf0 && lead <= 0xf4) {
    return { extraBytes: 3, minCodePoint: 0x10000, leadBits: lead & 0x07 };
  }
  return null;
}

function decodeCodePointAt(
  bytes: Uint8Array,
  index: number,
): { codePoint: number; next: number } | null {
  const lead = bytes[index] ?? 0;
  if (lead < 0x80) {
    return { codePoint: lead, next: index + 1 };
  }
  const shape = shapeOf(lead);
  if (shape === null || index + shape.extraBytes >= bytes.length) {
    return null;
  }
  let codePoint = shape.leadBits;
  for (let offset = 1; offset <= shape.extraBytes; offset += 1) {
    const byte = bytes[index + offset] ?? 0;
    if ((byte & 0xc0) !== 0x80) {
      return null;
    }
    codePoint = (codePoint << 6) | (byte & 0x3f);
  }
  const isSurrogate = codePoint >= 0xd800 && codePoint <= 0xdfff;
  if (codePoint < shape.minCodePoint || codePoint > 0x10ffff || isSurrogate) {
    return null;
  }
  return { codePoint, next: index + shape.extraBytes + 1 };
}

/**
 * Decodifica UTF-8 de forma estricta: rechaza bytes de continuación sueltos, secuencias
 * overlong, sustitutos codificados, puntos de código mayores a U+10FFFF y secuencias truncadas.
 * Mantiene un BOM inicial como U+FEFF. Idéntico en Jest y en Hermes.
 */
export function decodeUtf8Strict(bytes: Uint8Array): Result<string, 'invalid_utf8'> {
  const parts: string[] = [];
  let units: number[] = [];
  let index = 0;
  while (index < bytes.length) {
    const decoded = decodeCodePointAt(bytes, index);
    if (decoded === null) {
      return err('invalid_utf8');
    }
    index = decoded.next;
    if (decoded.codePoint >= 0x10000) {
      const offset = decoded.codePoint - 0x10000;
      units.push(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
    } else {
      units.push(decoded.codePoint);
    }
    if (units.length >= CHUNK_SIZE) {
      parts.push(String.fromCharCode(...units));
      units = [];
    }
  }
  parts.push(String.fromCharCode(...units));
  return ok(parts.join(''));
}
