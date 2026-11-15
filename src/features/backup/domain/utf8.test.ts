import { decodeUtf8Strict, encodeUtf8 } from './utf8';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('encodeUtf8', () => {
  test('encodes ASCII, accents, ñ, and emoji like the standard', () => {
    const text = 'abc áéíóú ñ € 🎨 ﻿';
    expect(Array.from(encodeUtf8(text))).toEqual(Array.from(Buffer.from(text, 'utf8')));
  });

  test('encodes a lone surrogate as U+FFFD', () => {
    expect(Array.from(encodeUtf8('a\uD800b'))).toEqual([0x61, 0xef, 0xbf, 0xbd, 0x62]);
  });

  test.each([
    ['a lone low surrogate', 'x\uDC00y'],
    ['a lone high surrogate at the end', 'abc\uD83D'],
    ['a high surrogate followed by a letter', '\uD83Dz'],
    ['two high surrogates in a row', '\uD83D\uD83D\uDE00'],
    ['every width of sequence', 'a\u00e9\u20ac\u{1f3a8}'],
  ])('encodes %s like the standard', (_name, text) => {
    expect(Array.from(encodeUtf8(text))).toEqual(Array.from(new TextEncoder().encode(text)));
  });

  test('returns a buffer of exactly the encoded size', () => {
    const text = 'ñ🎨a€'.repeat(1000);
    const bytes = encodeUtf8(text);
    expect(bytes.length).toBe(Buffer.byteLength(text, 'utf8'));
    expect(bytes.buffer.byteLength).toBe(bytes.length);
  });

  test('encodes the empty string as no bytes', () => {
    expect(encodeUtf8('')).toHaveLength(0);
  });
});

describe('decodeUtf8Strict', () => {
  test('round-trips accents, ñ, emoji and surrogate pairs', () => {
    const text = 'Lámina ñandú 🎨 €';
    expect(decodeUtf8Strict(encodeUtf8(text))).toEqual({ ok: true, value: text });
  });

  test('decodes a large buffer', () => {
    const text = 'ñ🎨a'.repeat(50_000);
    const result = decodeUtf8Strict(encodeUtf8(text));
    expect(result).toEqual({ ok: true, value: text });
  });

  test.each([
    ['a stray continuation byte', bytes(0x80)],
    ['an overlong two-byte sequence', bytes(0xc0, 0x80)],
    ['an overlong three-byte sequence', bytes(0xe0, 0x80, 0x80)],
    ['an overlong four-byte sequence', bytes(0xf0, 0x80, 0x80, 0x80)],
    ['an encoded surrogate', bytes(0xed, 0xa0, 0x80)],
    ['a code point above U+10FFFF', bytes(0xf4, 0x90, 0x80, 0x80)],
    ['a truncated sequence', bytes(0xe2, 0x82)],
    ['a bad continuation byte', bytes(0xe2, 0x41, 0xac)],
    ['an invalid lead byte', bytes(0xff)],
  ])('rejects %s', (_label, input) => {
    expect(decodeUtf8Strict(input)).toEqual({ ok: false, error: 'invalid_utf8' });
  });
});
