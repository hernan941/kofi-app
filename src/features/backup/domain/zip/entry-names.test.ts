import {
  entryNameKey,
  isBackupEntryName,
  isPrintableAsciiName,
  isSafeEntryName,
} from './entry-names';

const ID = '0191a2b3-c4d5-7e6f-8a9b-0c1d2e3f4a5b';

describe('isBackupEntryName', () => {
  test.each(['manifest.json', 'data.json', `photos/${ID}.jpg`])('accepts %s', (name) => {
    expect(isBackupEntryName(name)).toBe(true);
  });

  test.each([
    '',
    '../x',
    '..\\x',
    '/data.json',
    'C:data.json',
    `photos\\${ID}.jpg`,
    `photos/${ID.toUpperCase()}.jpg`,
    `photos/${ID}.jpeg`,
    `photos/${ID}.jpg/`,
    `photos//${ID}.jpg`,
    `photos/../${ID}.jpg`,
    'photos/',
    'MANIFEST.JSON',
    'data.json\0',
    'data.json ',
    'cuantovendi.db',
  ])('rejects %j', (name) => {
    expect(isBackupEntryName(name)).toBe(false);
  });
});

describe('isSafeEntryName', () => {
  test.each(['info.json', 'cuantovendi.db', 'cuantovendi.db-wal', `photos/${ID}.jpg`])(
    'accepts %s',
    (name) => {
      expect(isSafeEntryName(name)).toBe(true);
    },
  );

  test.each([
    '',
    '/abs',
    '../x',
    'a/../b',
    '..',
    'a//b',
    'a/',
    'a\\b',
    'C:x',
    'ñ.json',
    'a\0b',
    'a\tb',
    'x'.repeat(256),
  ])('rejects %j', (name) => {
    expect(isSafeEntryName(name)).toBe(false);
  });

  test('accepts a name of exactly 255 bytes', () => {
    expect(isSafeEntryName('x'.repeat(255))).toBe(true);
  });
});

describe('isPrintableAsciiName', () => {
  test('requires 1..255 printable ASCII bytes', () => {
    expect(isPrintableAsciiName(new TextEncoder().encode('a b'))).toBe(true);
    expect(isPrintableAsciiName(new Uint8Array(0))).toBe(false);
    expect(isPrintableAsciiName(new Uint8Array([0x61, 0x00]))).toBe(false);
    expect(isPrintableAsciiName(new Uint8Array([0xc3, 0xb1]))).toBe(false);
    expect(isPrintableAsciiName(new Uint8Array(256).fill(0x61))).toBe(false);
  });
});

describe('entryNameKey', () => {
  test('compares names without case', () => {
    expect(entryNameKey('Manifest.JSON')).toBe(entryNameKey('manifest.json'));
  });
});
