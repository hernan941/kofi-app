import { crc32 as referenceCrc32 } from 'node:zlib';

import { crc32 } from './crc32';

const ascii = (text: string) => new Uint8Array(Buffer.from(text, 'ascii'));

describe('crc32', () => {
  test.each([
    ['', 0x00000000],
    ['a', 0xe8b7be43],
    ['123456789', 0xcbf43926],
    ['The quick brown fox jumps over the lazy dog', 0x414fa339],
  ])('matches the known vector for %j', (text, expected) => {
    expect(crc32(0, ascii(text))).toBe(expected);
  });

  test('is incremental: chunks give the same value as one block', () => {
    const data = ascii('The quick brown fox jumps over the lazy dog');
    const partial = crc32(
      crc32(crc32(0, data.subarray(0, 5)), data.subarray(5, 20)),
      data.subarray(20),
    );
    expect(partial).toBe(crc32(0, data));
  });

  test('returns an unsigned 32-bit value', () => {
    expect(crc32(0, new Uint8Array(100).fill(0xff))).toBeGreaterThanOrEqual(0);
  });

  test('matches the Node reference implementation on pseudo-random data', () => {
    const data = new Uint8Array(5000).map((_, index) => (index * 31 + 7) & 0xff);
    expect(crc32(0, data)).toBe(referenceCrc32(data));
  });

  test.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1023])(
    'matches the reference with %i bytes, whatever the remainder of the unrolled loop',
    (length) => {
      const data = new Uint8Array(length).map((_, index) => (index * 131 + 17) & 0xff);
      expect(crc32(0, data)).toBe(referenceCrc32(data));
    },
  );

  test('is incremental at offsets that are not multiples of the unrolled step', () => {
    const data = new Uint8Array(1000).map((_, index) => (index * 29 + 3) & 0xff);
    const partial = crc32(
      crc32(crc32(0, data.subarray(0, 3)), data.subarray(3, 502)),
      data.subarray(502),
    );
    expect(partial).toBe(referenceCrc32(data));
  });
});
