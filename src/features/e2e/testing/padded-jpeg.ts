const SOI_LENGTH = 2;
const COM_MARKER = 0xfe;
const COM_OVERHEAD = 4;
const MAX_COM_TOTAL = 65_537;
const MIN_COM_TOTAL = COM_OVERHEAD;
const ZIP_SIGNATURES: readonly (readonly number[])[] = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x01, 0x02],
  [0x50, 0x4b, 0x07, 0x08],
];

/** Generador pseudoaleatorio determinista (xorshift32); mismo `seed`, mismos bytes. */
function createRandom(seed: number): () => number {
  let state = (seed ^ 0x9e3779b9) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state & 0xff;
  };
}

function commentSegment(total: number, random: () => number): Uint8Array {
  const segment = new Uint8Array(total);
  const length = total - 2;
  segment[0] = 0xff;
  segment[1] = COM_MARKER;
  segment[2] = length >> 8;
  segment[3] = length & 0xff;
  for (let index = COM_OVERHEAD; index < total; index += 1) {
    segment[index] = random();
  }
  let at = COM_OVERHEAD;
  for (const signature of ZIP_SIGNATURES) {
    if (at + signature.length <= total) {
      segment.set(signature, at);
      at += signature.length;
    }
  }
  return segment;
}

function planSegments(extraBytes: number): number[] {
  const totals: number[] = [];
  let remaining = extraBytes;
  while (remaining > 0) {
    let take = Math.min(remaining, MAX_COM_TOTAL);
    const rest = remaining - take;
    if (rest > 0 && rest < MIN_COM_TOTAL) {
      take -= MIN_COM_TOTAL;
    }
    totals.push(take);
    remaining -= take;
  }
  return totals;
}

/**
 * Devuelve un JPEG válido de exactamente `targetBytes`: agrega segmentos `COM` justo después de
 * `SOI`, con bytes pseudoaleatorios deterministas que incluyen las firmas ZIP `PK\x03\x04`,
 * `PK\x01\x02` y `PK\x07\x08`. Los decodificadores ignoran los comentarios, y las firmas dentro de
 * los datos de una foto ejercitan la validación estricta del lector del respaldo.
 * @throws {RangeError} Si `base` no es un JPEG o `targetBytes` no se puede alcanzar.
 */
export function paddedJpeg(base: Uint8Array, targetBytes: number, seed: number): Uint8Array {
  const extra = targetBytes - base.length;
  if (base[0] !== 0xff || base[1] !== 0xd8) {
    throw new RangeError('The base is not a JPEG.');
  }
  if (extra < 0 || (extra > 0 && extra < MIN_COM_TOTAL)) {
    throw new RangeError('The target size cannot be reached with comment segments.');
  }
  const random = createRandom(seed);
  const segments = planSegments(extra).map((total) => commentSegment(total, random));
  const out = new Uint8Array(targetBytes);
  out.set(base.subarray(0, SOI_LENGTH), 0);
  let offset = SOI_LENGTH;
  for (const segment of segments) {
    out.set(segment, offset);
    offset += segment.length;
  }
  out.set(base.subarray(SOI_LENGTH), offset);
  return out;
}

/** Ancho y alto de un JPEG leídos de su marcador `SOF`, o `null` si no se encuentra. */
export function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = SOI_LENGTH;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    const marker = bytes[offset + 1] ?? 0;
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      return {
        height: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
        width: ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0),
      };
    }
    offset += 2 + length;
  }
  return null;
}
