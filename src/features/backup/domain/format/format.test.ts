import {
  clpSchema,
  deterministicId,
  epochMsSchema,
  localDateSchema,
  noSalesWeekIdSchema,
} from '@/shared/domain';

import {
  itemRow,
  noSalesWeekRow,
  photoRow,
  productRow,
  recordRow,
  richSnapshot,
  testId,
  versionRow,
  EMPTY_SNAPSHOT,
} from '../../testing/snapshot-fixtures';
import { backupDataV1Schema, type BackupDataV1 } from './backup-data-v1';
import { buildManifest, encodeJson, photoEntryPath, photoIdFromEntryPath } from './contents';
import { checkIntegrity, checkPhotoFiles } from './integrity';
import { backupManifestV1Schema, manifestEnvelopeSchema } from './manifest';
import { backupDataToSnapshot, snapshotToBackupData } from './mapping';
import { readBackupData } from './read-backup-data';
import { decodeUtf8Strict } from '../utf8';

const NOW = epochMsSchema.parse(1_700_000_000_000);

function manifestFor(data: BackupDataV1, overrides: Record<string, unknown> = {}) {
  return {
    ...buildManifest({
      now: NOW,
      appVersion: '1.0.0',
      data,
      dataFile: { byteSize: 10, sha256: 'b'.repeat(64) },
    }),
    ...overrides,
  };
}

const richData = () => snapshotToBackupData(richSnapshot());

type Tables = Record<string, Record<string, unknown>[]>;

function tableOf(tables: Tables, name: string): Record<string, unknown>[] {
  const rows = tables[name];
  if (rows === undefined) {
    throw new Error(`missing table ${name}`);
  }
  return rows;
}

function rowOf(tables: Tables, name: string, index: number): Record<string, unknown> {
  const row = tableOf(tables, name)[index];
  if (row === undefined) {
    throw new Error(`missing row ${name}.${String(index)}`);
  }
  return row;
}

function photoOf(data: BackupDataV1, index: number): BackupDataV1['productPhotos'][number] {
  const photo = data.productPhotos[index];
  if (photo === undefined) {
    throw new Error('missing photo');
  }
  return photo;
}

function mutate(change: (data: Tables) => void) {
  const copy = JSON.parse(JSON.stringify(richData())) as Tables;
  change(copy);
  return copy;
}

describe('mapping', () => {
  test('round-trips a snapshot without losing data (archived, soft-deleted, nulls, accents)', () => {
    const snapshot = richSnapshot();
    const back = backupDataToSnapshot(snapshotToBackupData(snapshot));
    const sortById = <T extends { id: string }>(rows: readonly T[]) =>
      [...rows].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(back.products).toEqual(sortById(snapshot.products));
    expect(back.productVersions).toEqual(sortById(snapshot.productVersions));
    expect(back.productPhotos).toEqual(sortById(snapshot.productPhotos));
    expect(back.saleRecords).toEqual(sortById(snapshot.saleRecords));
    expect(back.saleItems).toEqual(sortById(snapshot.saleItems));
    expect(back.noSalesWeeks).toEqual(snapshot.noSalesWeeks);
    expect(back.tipViews).toEqual(snapshot.tipViews);
  });

  test('exported data passes its own strict schema through JSON', () => {
    const json = JSON.parse(JSON.stringify(richData())) as unknown;
    expect(backupDataV1Schema.safeParse(json).success).toBe(true);
  });

  test('is deterministic regardless of input order', () => {
    const snapshot = richSnapshot();
    const reversed = { ...snapshot, products: [...snapshot.products].reverse() };
    expect(JSON.stringify(snapshotToBackupData(reversed))).toBe(
      JSON.stringify(snapshotToBackupData(snapshot)),
    );
  });

  test('an empty snapshot round-trips', () => {
    expect(backupDataToSnapshot(snapshotToBackupData(EMPTY_SNAPSHOT))).toEqual(EMPTY_SNAPSHOT);
  });
});

describe('readBackupData / schema', () => {
  test('accepts valid v1 data', () => {
    expect(readBackupData(1, JSON.parse(JSON.stringify(richData()))).ok).toBe(true);
  });

  test('rejects an unknown key', () => {
    const data = mutate((d) => {
      rowOf(d, 'products', 0).extra = 1;
    });
    expect(readBackupData(1, data)).toEqual({
      ok: false,
      error: { code: 'invalid_data', issues: ['products.0'] },
    });
  });

  test('rejects an unknown top-level key', () => {
    expect(readBackupData(1, { ...richData(), other: [] }).ok).toBe(false);
  });

  test.each([
    ['negative amount', (d: Tables) => (rowOf(d, 'saleItems', 0).unitPrice = -1)],
    [
      'amount above the maximum',
      (d: Tables) => (rowOf(d, 'saleItems', 0).unitPrice = 1_000_000_000),
    ],
    ['zero quantity', (d: Tables) => (rowOf(d, 'saleItems', 0).quantity = 0)],
    ['quantity above 9999', (d: Tables) => (rowOf(d, 'saleItems', 0).quantity = 10_000)],
    ['uppercase sha256', (d: Tables) => (rowOf(d, 'productPhotos', 0).sha256 = 'A'.repeat(64))],
    ['negotiable with price', (d: Tables) => (rowOf(d, 'productVersions', 1).price = 5)],
    ['fixed without price', (d: Tables) => (rowOf(d, 'productVersions', 0).price = null)],
    [
      'week start not a Monday',
      (d: Tables) => (rowOf(d, 'noSalesWeeks', 0).weekStart = '2026-02-24'),
    ],
    ['invalid date', (d: Tables) => (rowOf(d, 'saleRecords', 0).soldOn = '2026-02-30')],
    ['empty product name', (d: Tables) => (rowOf(d, 'products', 0).name = '')],
    ['product name over 80', (d: Tables) => (rowOf(d, 'products', 0).name = 'x'.repeat(81))],
    ['note over 500', (d: Tables) => (rowOf(d, 'saleRecords', 0).note = 'x'.repeat(501))],
    ['zero photo width', (d: Tables) => (rowOf(d, 'productPhotos', 0).width = 0)],
    ['negative position', (d: Tables) => (rowOf(d, 'productVersions', 0).position = -1)],
    ['unknown channel', (d: Tables) => (rowOf(d, 'saleRecords', 0).channel = 'x')],
    ['non-integer timestamp', (d: Tables) => (rowOf(d, 'products', 0).createdAt = 1.5)],
  ])('rejects %s', (_label, change) => {
    const result = readBackupData(1, mutate(change));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_data');
    }
  });

  test('reports the path of the issue, at most 20', () => {
    const data = mutate((d) => {
      for (const item of tableOf(d, 'saleItems')) {
        item.quantity = 0;
      }
      d.saleItems = Array.from({ length: 30 }, (_, index) => ({
        ...rowOf(d, 'saleItems', 0),
        id: testId(5, 100 + index),
      }));
    });
    const result = readBackupData(1, data);
    expect(!result.ok && result.error.code === 'invalid_data' && result.error.issues).toHaveLength(
      20,
    );
    expect(!result.ok && result.error.code === 'invalid_data' && result.error.issues[0]).toBe(
      'saleItems.0.quantity',
    );
  });

  test('a newer format version is newer_format and non-objects are invalid_data', () => {
    expect(readBackupData(2, {})).toEqual({
      ok: false,
      error: { code: 'newer_format', formatVersion: 2 },
    });
    expect(readBackupData(1, 'x').ok).toBe(false);
    expect(readBackupData(1, null).ok).toBe(false);
  });
});

describe('manifest', () => {
  test('builds counts and files: data.json then active photos by id, without deleted ones', () => {
    const data = richData();
    const manifest = manifestFor(data);
    expect(manifest.counts).toEqual({ products: 2, saleRecords: 2, activePhotos: 1 });
    expect(manifest.files.map((file) => file.path)).toEqual([
      'data.json',
      photoEntryPath(photoOf(data, 0).id),
    ]);
    expect(manifest.createdAt).toBe('2023-11-14T22:13:20.000Z');
    expect(backupManifestV1Schema.safeParse(JSON.parse(JSON.stringify(manifest))).success).toBe(
      true,
    );
  });

  test('the strict schema rejects unknown keys, a wrong format and a bad date', () => {
    const base = JSON.parse(JSON.stringify(manifestFor(richData()))) as Record<string, unknown>;
    expect(backupManifestV1Schema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(backupManifestV1Schema.safeParse({ ...base, format: 'other' }).success).toBe(false);
    expect(backupManifestV1Schema.safeParse({ ...base, createdAt: 'ayer' }).success).toBe(false);
    expect(backupManifestV1Schema.safeParse({ ...base, formatVersion: 2 }).success).toBe(false);
  });

  test('the envelope accepts any format and version', () => {
    expect(
      manifestEnvelopeSchema.safeParse({ format: 'x', formatVersion: 9, more: 1 }).success,
    ).toBe(true);
    expect(manifestEnvelopeSchema.safeParse({ format: 1 }).success).toBe(false);
  });

  test('photo entry paths round-trip and reject foreign names', () => {
    const id = photoOf(richData(), 0).id;
    expect(photoIdFromEntryPath(photoEntryPath(id))).toBe(id);
    expect(photoIdFromEntryPath('photos/x.jpg')).toBeNull();
    expect(photoIdFromEntryPath('data.json')).toBeNull();
  });

  test('encodeJson is compact UTF-8', () => {
    const bytes = encodeJson({ a: 'ñ' });
    expect(decodeUtf8Strict(bytes)).toEqual({ ok: true, value: '{"a":"ñ"}' });
  });
});

describe('checkIntegrity', () => {
  const run = (data: BackupDataV1, overrides: Record<string, unknown> = {}) =>
    checkIntegrity(data, backupManifestV1Schema.parse(manifestFor(data, overrides)));

  test('accepts coherent data, including soft-deleted rows', () => {
    expect(run(richData())).toEqual({ ok: true, value: undefined });
  });

  test.each([
    [
      'a duplicate product id',
      (d: Tables) => tableOf(d, 'products').push({ ...rowOf(d, 'products', 0) }),
    ],
    [
      'a duplicate week start',
      (d: Tables) =>
        tableOf(d, 'noSalesWeeks').push({ ...rowOf(d, 'noSalesWeeks', 0), id: testId(9, 1) }),
    ],
    [
      'a duplicate tip id',
      (d: Tables) => tableOf(d, 'tipViews').push({ ...rowOf(d, 'tipViews', 0) }),
    ],
  ])('rejects %s as invalid_data', (_label, change) => {
    const data = backupDataV1Schema.parse(mutate(change));
    const result = run(data);
    expect(!result.ok && result.error.code).toBe('invalid_data');
  });

  test.each([
    [
      'a version of a missing product',
      (d: Tables) => (rowOf(d, 'productVersions', 0).productId = testId(1, 99)),
    ],
    [
      'a photo of a missing product',
      (d: Tables) => (rowOf(d, 'productPhotos', 0).productId = testId(1, 99)),
    ],
    [
      'an item of a missing record',
      (d: Tables) => (rowOf(d, 'saleItems', 0).saleRecordId = testId(4, 99)),
    ],
    [
      'an item of a missing product',
      (d: Tables) => (rowOf(d, 'saleItems', 0).productId = testId(1, 99)),
    ],
    [
      'an item with a missing version',
      (d: Tables) => (rowOf(d, 'saleItems', 0).productVersionId = testId(2, 99)),
    ],
    [
      'an item whose version belongs to another product',
      (d: Tables) => (rowOf(d, 'saleItems', 0).productId = testId(1, 2)),
    ],
  ])('rejects %s as broken_references', (_label, change) => {
    const data = backupDataV1Schema.parse(mutate(change));
    expect(run(data)).toEqual({ ok: false, error: { code: 'broken_references' } });
  });

  test('rejects a no-sales id that is not the UUIDv5 of its week', () => {
    const data = backupDataV1Schema.parse(
      mutate((d) => {
        rowOf(d, 'noSalesWeeks', 0).id = deterministicId('2026-03-02');
      }),
    );
    const result = run(data);
    expect(!result.ok && result.error).toEqual({
      code: 'invalid_data',
      issues: ['noSalesWeeks.id'],
    });
    expect(noSalesWeekIdSchema.safeParse((data.noSalesWeeks[0] ?? fail()).id).success).toBe(true);
  });

  test.each(['products', 'saleRecords', 'activePhotos'])('rejects wrong counts.%s', (key) => {
    const data = richData();
    const manifest = manifestFor(data);
    const wrong = { ...manifest, counts: { ...manifest.counts, [key]: 99 } };
    const result = checkIntegrity(data, backupManifestV1Schema.parse(wrong));
    expect(!result.ok && result.error).toEqual({ code: 'invalid_data', issues: [`counts.${key}`] });
  });

  test('accepts an empty database', () => {
    expect(run(snapshotToBackupData(EMPTY_SNAPSHOT)).ok).toBe(true);
  });

  test('keeps unused helpers honest', () => {
    expect([productRow, versionRow, photoRow, recordRow, itemRow, noSalesWeekRow]).toHaveLength(6);
    expect([clpSchema, localDateSchema]).toHaveLength(2);
  });
});

describe('checkPhotoFiles', () => {
  const check = (data: BackupDataV1, files: unknown) => {
    const manifest = backupManifestV1Schema.parse({ ...manifestFor(data), files });
    return checkPhotoFiles(data, manifest);
  };
  const data = richData();
  const photo = photoOf(data, 0);
  const good = [
    { path: 'data.json', byteSize: 5, sha256: 'b'.repeat(64) },
    { path: photoEntryPath(photo.id), byteSize: photo.byteSize, sha256: photo.sha256 },
  ];

  test('accepts one file per active photo and none for deleted photos', () => {
    expect(check(data, good)).toEqual({ ok: true, value: undefined });
  });

  test('rejects an active photo without a file', () => {
    expect(check(data, good.slice(0, 1))).toEqual({
      ok: false,
      error: { code: 'broken_references' },
    });
  });

  test('rejects a file without an active photo (including a deleted one)', () => {
    const deleted = photoOf(data, 1);
    const extra = [
      ...good,
      { path: photoEntryPath(deleted.id), byteSize: 1, sha256: 'c'.repeat(64) },
    ];
    expect(check(data, extra)).toEqual({ ok: false, error: { code: 'broken_references' } });
  });

  test('rejects a different byteSize or sha256', () => {
    const size = [good[0], { ...(good[1] ?? fail()), byteSize: 1 }];
    const sha = [good[0], { ...(good[1] ?? fail()), sha256: 'd'.repeat(64) }];
    expect(check(data, size).ok).toBe(false);
    expect(check(data, sha).ok).toBe(false);
  });

  test('rejects duplicate, missing data.json, manifest.json and foreign paths as invalid_data', () => {
    for (const files of [
      [...good, good[1]],
      good.slice(1),
      [...good, { path: 'manifest.json', byteSize: 1, sha256: 'e'.repeat(64) }],
      [...good, { path: 'other.bin', byteSize: 1, sha256: 'e'.repeat(64) }],
    ]) {
      const result = check(data, files);
      expect(!result.ok && result.error.code).toBe('invalid_data');
    }
  });
});

function fail(): never {
  throw new Error('unexpected missing value');
}
