import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MemoryFile, MemoryWriter } from '../../testing/in-memory-zip-files';
import { buildZip, textEntry, type ZipEntrySpec } from '../../testing/zip-fixture-builder';
import { encodeUtf8 } from '../utf8';
import { crc32 } from './crc32';
import { openStoredArchive, readVerifiedEntry, writeStoredArchive } from './archive';
import { BACKUP_ZIP_LIMITS, type ZipFormatError, type ZipLimits } from './format';

const PHOTO_ID = '0191a2b3-c4d5-7e6f-8a9b-0c1d2e3f4a5b';
const PHOTO = `photos/${PHOTO_ID}.jpg`;
const SIGNATURES = new Uint8Array([
  ...[0x50, 0x4b, 0x03, 0x04],
  ...[0x50, 0x4b, 0x07, 0x08],
  ...[0x50, 0x4b, 0x01, 0x02],
  ...[0x50, 0x4b, 0x05, 0x06],
]);

const manifest = (): ZipEntrySpec => textEntry('manifest.json', '{"format":"cuantovendi-backup"}');
const data = (): ZipEntrySpec => textEntry('data.json', '{"products":[]}');
const photo = (): ZipEntrySpec => ({ name: PHOTO, data: SIGNATURES });
const validEntries = (): ZipEntrySpec[] => [manifest(), data(), photo()];

async function open(bytes: Uint8Array, limits: ZipLimits = BACKUP_ZIP_LIMITS) {
  return openStoredArchive(new MemoryFile(bytes), limits);
}

async function expectRejected(bytes: Uint8Array, code: ZipFormatError, limits?: ZipLimits) {
  const result = await open(bytes, limits);
  expect(result).toEqual({ ok: false, error: code });
}

function inputOf(path: string, bytes: Uint8Array) {
  return {
    path,
    size: bytes.length,
    readRange: (offset: number, length: number) =>
      Promise.resolve(bytes.slice(offset, offset + length)),
  };
}

async function writeValid(): Promise<Uint8Array> {
  const writer = new MemoryWriter();
  await writeStoredArchive(writer, [
    inputOf('manifest.json', encodeUtf8('{"a":1}')),
    inputOf('data.json', encodeUtf8('{"b":2}')),
    inputOf(PHOTO, SIGNATURES),
  ]);
  return writer.toBytes();
}

describe('write then read', () => {
  test('reads back every entry with a verified CRC', async () => {
    const bytes = await writeValid();
    const file = new MemoryFile(bytes);
    const result = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect([...result.value.entries.keys()]).toEqual(['manifest.json', 'data.json', PHOTO]);
    const entry = result.value.entries.get(PHOTO);
    expect(entry).toBeDefined();
    if (entry === undefined) {
      return;
    }
    expect(await readVerifiedEntry(file, entry)).toEqual({ ok: true, value: SIGNATURES });
  });

  test('is deterministic: two runs produce identical bytes', async () => {
    expect(await writeValid()).toEqual(await writeValid());
  });

  test('matches what the fixture builder produces without options', async () => {
    const built = buildZip([
      { name: 'manifest.json', data: encodeUtf8('{"a":1}') },
      { name: 'data.json', data: encodeUtf8('{"b":2}') },
      { name: PHOTO, data: SIGNATURES },
    ]);
    expect(await writeValid()).toEqual(built);
  });

  test('does not read entry data while opening', async () => {
    const bytes = buildZip([manifest(), { name: PHOTO, data: new Uint8Array(5000).fill(7) }]);
    const file = new MemoryFile(bytes);
    const result = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const photoEntry = result.value.entries.get(PHOTO);
    for (const { offset, length } of file.reads) {
      const end = offset + length;
      const touchesData =
        photoEntry !== undefined &&
        offset < photoEntry.dataOffset + photoEntry.size &&
        end > photoEntry.dataOffset;
      expect(touchesData).toBe(false);
    }
  });

  test('opens an archive with no entries', async () => {
    const result = await open(buildZip([]));
    expect(result.ok && result.value.entries.size).toBe(0);
  });
});

describe('archive written by a standard tool (STORED)', () => {
  const bytes = new Uint8Array(
    readFileSync(join(__dirname, '__fixtures__', 'standard-tool-stored.zip')),
  );

  test('opens and reads every entry', async () => {
    const file = new MemoryFile(bytes);
    const result = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.entries.size).toBe(3);
    for (const entry of result.value.entries.values()) {
      expect((await readVerifiedEntry(file, entry)).ok).toBe(true);
    }
  });

  test('reads photo data that contains ZIP signatures', async () => {
    const file = new MemoryFile(bytes);
    const result = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    const entry = result.ok
      ? result.value.entries.get(`photos/00000000-0000-7000-8000-000000000001.jpg`)
      : undefined;
    expect(entry).toBeDefined();
    if (entry === undefined) {
      return;
    }
    const read = await readVerifiedEntry(file, entry);
    expect(read.ok && read.value.slice(8, 12)).toEqual(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
  });
});

describe('adversarial archives', () => {
  test('photo data with PK signatures is read correctly', async () => {
    const bytes = buildZip(validEntries());
    const file = new MemoryFile(bytes);
    const result = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    expect(result.ok).toBe(true);
    const entry = result.ok ? result.value.entries.get(PHOTO) : undefined;
    expect(entry && (await readVerifiedEntry(file, entry))).toEqual({
      ok: true,
      value: SIGNATURES,
    });
  });

  test.each([
    '../x',
    '..\\x',
    '/abs',
    'C:x',
    `photos\\${PHOTO_ID}.jpg`,
    'a\0b',
    'photos/',
    `photos/${PHOTO_ID.toUpperCase()}.jpg`,
    'other.txt',
  ])('rejects the name %j with invalid_name', async (name) => {
    await expectRejected(buildZip([{ name, data: new Uint8Array(1) }]), 'invalid_name');
  });

  test('rejects a name with bytes outside printable ASCII', async () => {
    await expectRejected(
      buildZip([{ name: 'x', data: new Uint8Array(1), nameBytes: encodeUtf8('ñ.json') }]),
      'invalid_name',
    );
  });

  test('rejects an empty name', async () => {
    await expectRejected(
      buildZip([{ name: 'x', data: new Uint8Array(1), nameBytes: new Uint8Array(0) }]),
      'invalid_name',
    );
  });

  test('rejects deflate entries with compressed_entry', async () => {
    await expectRejected(
      buildZip([{ ...data(), method: 8, compressedSize: 5 }]),
      'compressed_entry',
    );
  });

  test('rejects a compressed size different from the size', async () => {
    await expectRejected(buildZip([{ ...data(), compressedSize: 3 }]), 'compressed_entry');
  });

  test('rejects duplicate names', async () => {
    await expectRejected(buildZip([data(), data()]), 'duplicate_entry');
  });

  test('rejects names that differ only by case', async () => {
    await expectRejected(
      buildZip([manifest(), { ...manifest(), name: 'MANIFEST.JSON' }]),
      'duplicate_entry',
    );
  });

  test.each([
    ['crc32', { crc32: 123 }],
    ['size', { size: 3, compressedSize: 3 }],
    ['method', { method: 8 }],
    ['flags', { flags: 0 }],
    ['version', { versionNeeded: 10 }],
    ['name', { nameBytes: encodeUtf8('data.jsoN') }],
  ])('rejects a local header whose %s does not match the central one', async (_label, local) => {
    await expectRejected(buildZip([{ ...data(), local }]), 'header_mismatch');
  });

  test('rejects overlapping entries', async () => {
    const first = photo();
    const second = { ...data(), localHeaderOffset: 10 };
    await expectRejected(buildZip([first, second]), 'overlapping_entries');
  });

  test('rejects two entries that start at the same offset', async () => {
    await expectRejected(
      buildZip([manifest(), { ...data(), localHeaderOffset: 0 }]),
      'overlapping_entries',
    );
  });

  test('rejects hidden bytes before the first entry', async () => {
    await expectRejected(
      buildZip(validEntries(), { bytesBeforeFirstEntry: new Uint8Array(3) }),
      'out_of_bounds',
    );
  });

  test('rejects hidden bytes between entries', async () => {
    await expectRejected(
      buildZip(validEntries(), { bytesAfterEachEntry: new Uint8Array(1) }),
      'out_of_bounds',
    );
  });

  test('rejects hidden bytes before the central directory', async () => {
    await expectRejected(
      buildZip(validEntries(), { bytesBetweenDataAndCentral: new Uint8Array(1) }),
      'out_of_bounds',
    );
  });

  test('rejects a second end-of-central-directory record', async () => {
    await expectRejected(buildZip(validEntries(), { duplicateEocd: true }), 'out_of_bounds');
  });

  test('rejects a central directory larger than its bytes', async () => {
    const real = buildZip(validEntries());
    const size = new DataView(real.buffer).getUint32(real.length - 10, true);
    await expectRejected(
      buildZip(validEntries(), { eocd: { cdSize: size + 20 } }),
      'out_of_bounds',
    );
  });

  test('rejects a central directory offset that does not end at the EOCD', async () => {
    const real = buildZip(validEntries());
    const offset = new DataView(real.buffer).getUint32(real.length - 6, true);
    await expectRejected(
      buildZip(validEntries(), { eocd: { cdOffset: offset - 1 } }),
      'out_of_bounds',
    );
  });

  test('rejects an entry that ends after the central directory', async () => {
    await expectRejected(
      buildZip([{ ...data(), size: 100, compressedSize: 100 }]),
      'out_of_bounds',
    );
  });

  test('rejects a truncated archive and tiny inputs with not_a_zip', async () => {
    const bytes = buildZip(validEntries());
    await expectRejected(bytes.slice(0, bytes.length - 10), 'not_a_zip');
    await expectRejected(bytes.slice(0, 10), 'not_a_zip');
    await expectRejected(new Uint8Array(0), 'not_a_zip');
    await expectRejected(encodeUtf8('this is not a zip file at all, only text'), 'not_a_zip');
  });

  test('rejects a wrong CRC when reading the entry', async () => {
    const bytes = buildZip([{ ...data(), crc32: 5 }]);
    const file = new MemoryFile(bytes);
    const result = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    expect(result.ok).toBe(true);
    const entry = result.ok ? result.value.entries.get('data.json') : undefined;
    expect(entry && (await readVerifiedEntry(file, entry))).toEqual({
      ok: false,
      error: { code: 'checksum_mismatch', path: 'data.json' },
    });
  });

  test('rejects a zip bomb: declared sizes above the limits', async () => {
    await expectRejected(
      buildZip([{ ...photo(), size: 0x7fffffff, compressedSize: 0x7fffffff }]),
      'too_large',
    );
    await expectRejected(
      buildZip([
        {
          ...photo(),
          size: BACKUP_ZIP_LIMITS.maxEntryBytes + 1,
          compressedSize: BACKUP_ZIP_LIMITS.maxEntryBytes + 1,
        },
      ]),
      'too_large',
    );
    await expectRejected(
      buildZip([
        {
          ...data(),
          size: BACKUP_ZIP_LIMITS.maxDataJsonBytes + 1,
          compressedSize: BACKUP_ZIP_LIMITS.maxDataJsonBytes + 1,
        },
      ]),
      'too_large',
    );
  });

  test('allows data.json up to its own larger limit', async () => {
    const entry = {
      ...data(),
      size: BACKUP_ZIP_LIMITS.maxEntryBytes + 1,
      compressedSize: BACKUP_ZIP_LIMITS.maxEntryBytes + 1,
    };
    await expectRejected(buildZip([entry]), 'out_of_bounds');
  });

  test('rejects an archive larger than the maximum', async () => {
    const limits = { ...BACKUP_ZIP_LIMITS, maxArchiveBytes: 100 };
    await expectRejected(buildZip(validEntries()), 'too_large', limits);
  });

  test('rejects more entries than the maximum', async () => {
    const limits = { ...BACKUP_ZIP_LIMITS, maxEntries: 2 };
    await expectRejected(buildZip(validEntries()), 'too_large', limits);
  });

  test('rejects a central directory that cannot fit its declared entries', async () => {
    await expectRejected(buildZip(validEntries(), { eocd: { cdSize: 3 * 301 + 1 } }), 'too_large');
  });

  test('rejects an EOCD comment', async () => {
    await expectRejected(
      buildZip(validEntries(), { eocd: { comment: encodeUtf8('hola') } }),
      'unsupported_feature',
    );
  });

  test('rejects an entry comment', async () => {
    await expectRejected(
      buildZip([{ ...data(), centralComment: encodeUtf8('c') }]),
      'unsupported_feature',
    );
  });

  test('rejects extra fields in both headers, and one only in the local header leaves hidden bytes', async () => {
    await expectRejected(
      buildZip([{ ...data(), extra: new Uint8Array(4) }]),
      'unsupported_feature',
    );
    await expectRejected(buildZip([{ ...data(), localExtra: new Uint8Array(4) }]), 'out_of_bounds');
  });

  test.each([
    ['encryption flag', { flags: 0x0801 }],
    ['data descriptor flag', { flags: 0x0808 }],
    ['any other flag bit', { flags: 0x0802 }],
    ['version needed 45', { versionNeeded: 45 }],
    ['ZIP64 sentinels', { versionNeeded: 45, size: 0xffffffff, compressedSize: 0xffffffff }],
    ['a ZIP64 sentinel in the sizes', { size: 0xffffffff, compressedSize: 0xffffffff }],
  ])('rejects %s', async (_label, overrides) => {
    await expectRejected(buildZip([{ ...data(), ...overrides }]), 'unsupported_feature');
  });

  test.each([
    ['entry count sentinel', { entryCount: 0xffff }],
    ['directory size sentinel', { cdSize: 0xffffffff }],
    ['directory offset sentinel', { cdOffset: 0xffffffff }],
    ['a non-zero disk', { diskNumber: 1 }],
    ['a non-zero directory disk', { cdDisk: 1 }],
    ['different entry counts per disk', { entriesOnDisk: 1 }],
  ])('rejects an EOCD with %s', async (_label, eocd) => {
    await expectRejected(buildZip(validEntries(), { eocd }), 'unsupported_feature');
  });

  test('rejects an entry that starts on another disk', async () => {
    await expectRejected(buildZip([{ ...data(), diskNumberStart: 1 }]), 'unsupported_feature');
  });

  test('rejects a ZIP64 local offset sentinel', async () => {
    await expectRejected(
      buildZip([{ ...data(), localHeaderOffset: 0xffffffff }]),
      'unsupported_feature',
    );
  });
});

describe('writeStoredArchive', () => {
  test('reports progress per entry and returns the entries', async () => {
    const progress: [number, number][] = [];
    const writer = new MemoryWriter();
    const entries = await writeStoredArchive(
      writer,
      [inputOf('manifest.json', encodeUtf8('{}')), inputOf('data.json', encodeUtf8('{}'))],
      (done, total) => progress.push([done, total]),
    );
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
    expect(entries.map((entry) => [entry.path, entry.localHeaderOffset])).toEqual([
      ['manifest.json', 0],
      ['data.json', 30 + 13 + 2],
    ]);
  });

  test('writes the fixed header values of ADR-012', async () => {
    const writer = new MemoryWriter();
    await writeStoredArchive(writer, [inputOf('data.json', encodeUtf8('{}'))]);
    const view = new DataView(writer.toBytes().buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(4, true)).toBe(20);
    expect(view.getUint16(6, true)).toBe(0x0800);
    expect(view.getUint16(8, true)).toBe(0);
    expect(view.getUint16(10, true)).toBe(0);
    expect(view.getUint16(12, true)).toBe(0x0021);
    expect(view.getUint16(28, true)).toBe(0);
  });

  test.each(['../x', '/abs', 'a\\b', '', 'a//b'])('rejects the unsafe name %j', async (path) => {
    await expect(
      writeStoredArchive(new MemoryWriter(), [inputOf(path, new Uint8Array(1))]),
    ).rejects.toThrow('invalid_name');
  });

  test('rejects duplicate names', async () => {
    await expect(
      writeStoredArchive(new MemoryWriter(), [
        inputOf('a.json', new Uint8Array(1)),
        inputOf('A.json', new Uint8Array(1)),
      ]),
    ).rejects.toThrow('duplicate_entry');
  });

  test('rejects more than 65,534 entries before writing anything', async () => {
    const writer = new MemoryWriter();
    const entries = Array.from({ length: 65_535 }, (_, index) =>
      inputOf(`f${String(index)}.bin`, new Uint8Array(0)),
    );
    await expect(writeStoredArchive(writer, entries)).rejects.toThrow('too_many_entries');
    expect(writer.position).toBe(0);
  });

  test('rejects a readRange that returns another number of bytes', async () => {
    const lying = {
      path: 'data.json',
      size: 10,
      readRange: () => Promise.resolve(new Uint8Array(4)),
    };
    await expect(writeStoredArchive(new MemoryWriter(), [lying])).rejects.toThrow('short_read');
  });

  test('copies an entry larger than the whole-read limit in 1 MiB blocks with the right CRC', async () => {
    const size = BACKUP_ZIP_LIMITS.maxEntryBytes + 5;
    const big = new Uint8Array(size).map((_, index) => (index * 7) & 0xff);
    const requests: number[] = [];
    const writer = new MemoryWriter();
    const [entry] = await writeStoredArchive(writer, [
      {
        path: 'cuantovendi.db',
        size,
        readRange: (offset, length) => {
          requests.push(length);
          return Promise.resolve(big.slice(offset, offset + length));
        },
      },
    ]);
    expect(Math.max(...requests)).toBe(1_048_576);
    expect(requests.length).toBeGreaterThan(2);
    expect(entry?.crc32).toBe(crc32(0, big));
    const written = writer.toBytes();
    const start = entry?.dataOffset ?? 0;
    expect(written.slice(start, start + size)).toEqual(big);
  });
});

describe('yielding between CRC32 blocks', () => {
  const THREE_BLOCKS = 2_621_440;
  const big = () => new Uint8Array(THREE_BLOCKS).map((_, index) => (index * 13 + 5) & 0xff);

  async function ordersAround(action: () => Promise<unknown>): Promise<string[]> {
    const order: string[] = [];
    setTimeout(() => {
      order.push('other task');
    }, 0);
    await action();
    order.push('finished');
    return order;
  }

  test('readVerifiedEntry lets other tasks run before it finishes and keeps the CRC', async () => {
    const bytes = big();
    const archive = buildZip([{ name: 'data.json', data: bytes }]);
    const file = new MemoryFile(archive);
    const opened = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    const entry = opened.ok ? opened.value.entries.get('data.json') : undefined;
    expect(entry).toBeDefined();
    if (entry === undefined) {
      return;
    }
    let result: Awaited<ReturnType<typeof readVerifiedEntry>> | undefined;

    const order = await ordersAround(async () => {
      result = await readVerifiedEntry(file, entry);
    });

    expect(order).toEqual(['other task', 'finished']);
    expect(result).toEqual({ ok: true, value: bytes });
  });

  test('a small entry is written with the right CRC, yielding between blocks', async () => {
    const bytes = big();
    const writer = new MemoryWriter();
    let entries: Awaited<ReturnType<typeof writeStoredArchive>> = [];

    const order = await ordersAround(async () => {
      entries = await writeStoredArchive(writer, [inputOf('data.json', bytes)]);
    });

    expect(order).toEqual(['other task', 'finished']);
    expect(entries[0]?.crc32).toBe(crc32(0, bytes));
  });

  test('an entry that fits in one block does not yield', async () => {
    const writer = new MemoryWriter();

    const order = await ordersAround(() =>
      writeStoredArchive(writer, [inputOf('data.json', encodeUtf8('{}'))]),
    );

    expect(order).toEqual(['finished']);
  });
});
