import { createFileLock } from '@/core/files/file-lock';
import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';
import { epochMsSchema, type ProductPhotoId } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import {
  BACKUP_ZIP_LIMITS,
  decodeUtf8Strict,
  encodeJson,
  encodeUtf8,
  openStoredArchive,
  readVerifiedEntry,
} from '../domain';
import { writeStoredArchive } from '../domain/zip/archive';
import type { DatabaseSnapshot } from '../domain/snapshot';
import { buildBackupArchive } from '../testing/backup-archive-builder';
import { FakeBackupFiles } from '../testing/fake-backup-files';
import { InMemoryArchiveIo } from '../testing/in-memory-archive-io';
import { MemoryWriter } from '../testing/in-memory-zip-files';
import { EMPTY_SNAPSHOT, productRow, richSnapshot } from '../testing/snapshot-fixtures';
import { buildZip, type ZipEntrySpec } from '../testing/zip-fixture-builder';
import { prepareRestore, type RestoreDeps } from './prepare-restore';

const SOURCE = 'file:///fake/cache/DocumentPicker/backup.zip';
const NOW = epochMsSchema.parse(Date.parse('2026-11-13T12:00:00Z'));
const PHOTO_BYTES = Uint8Array.from({ length: 300 }, (_, index) => (index * 7) % 251);

function photoIdOf(snapshot: DatabaseSnapshot): ProductPhotoId {
  const photo = snapshot.productPhotos.find((row) => row.deletedAt === null);
  if (photo === undefined) {
    throw new Error('The snapshot has no active photo.');
  }
  return photo.id;
}

async function validArchive(snapshot: DatabaseSnapshot = richSnapshot()): Promise<Uint8Array> {
  return buildBackupArchive({
    snapshot,
    photos: new Map([[photoIdOf(snapshot), PHOTO_BYTES]]),
  });
}

async function entriesOf(bytes: Uint8Array): Promise<{ name: string; data: Uint8Array }[]> {
  const io = new InMemoryArchiveIo();
  io.put('file:///a.zip', bytes);
  const file = await io.openForRead('file:///a.zip');
  const opened = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
  if (!opened.ok) {
    throw new Error('Cannot open the archive.');
  }
  const out: { name: string; data: Uint8Array }[] = [];
  for (const entry of opened.value.entries.values()) {
    const read = await readVerifiedEntry(file, entry);
    if (!read.ok) {
      throw new Error('Bad entry.');
    }
    out.push({ name: entry.path, data: read.value });
  }
  return out;
}

function pack(entries: readonly { name: string; data: Uint8Array }[]): Uint8Array {
  return buildZip(entries.map((entry): ZipEntrySpec => ({ name: entry.name, data: entry.data })));
}

function jsonOf(bytes: Uint8Array): Record<string, unknown> {
  const text = decodeUtf8Strict(bytes);
  if (!text.ok) {
    throw new Error('Not UTF-8.');
  }
  return JSON.parse(text.value) as Record<string, unknown>;
}

function setUp(current: DatabaseSnapshot = EMPTY_SNAPSHOT) {
  const io = new InMemoryArchiveIo();
  const replaceAll = jest.fn(() => Promise.resolve());
  const readSnapshot = jest.fn(() => Promise.resolve(current));
  const countActive = jest.fn(() =>
    Promise.resolve({
      products: current.products.filter((row) => row.deletedAt === null).length,
      saleRecords: current.saleRecords.filter((row) => row.deletedAt === null).length,
      activePhotos: current.productPhotos.filter((row) => row.deletedAt === null).length,
    }),
  );
  const deps: RestoreDeps = {
    archiveIo: io,
    backupFiles: new FakeBackupFiles(),
    store: { readSnapshot, countActive, replaceAll },
    photos: new InMemoryPhotoStorage(),
    fileLock: createFileLock(),
    clock: new FakeClock(NOW),
    logger: new RecordingLogger(),
    appVersion: '1.0.0',
    limits: BACKUP_ZIP_LIMITS,
    yieldToUi: () => Promise.resolve(),
  };
  return { deps, io, replaceAll, readSnapshot, countActive };
}

describe('prepareRestore', () => {
  it('returns the preview of a valid backup, with what the app holds today', async () => {
    const { deps, io } = setUp({ ...EMPTY_SNAPSHOT, products: [productRow(1), productRow(2)] });
    io.put(SOURCE, await validArchive());

    const result = await prepareRestore(deps, SOURCE);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.preview).toEqual({
      createdAt: Date.parse('2026-11-01T12:00:00Z'),
      products: 2,
      saleRecords: 2,
      activePhotos: 1,
      current: { products: 2, saleRecords: 0, activePhotos: 0 },
    });
    expect(result.value.sourceUri).toBe(SOURCE);
    expect(result.value.snapshot.products).toHaveLength(3);
    expect(result.value.photos).toHaveLength(1);
    expect(result.value.photos[0]?.size).toBe(PHOTO_BYTES.length);
  });

  it('counts what the app holds today without reading the whole snapshot', async () => {
    const { deps, io, readSnapshot, countActive } = setUp();
    io.put(SOURCE, await validArchive());

    await prepareRestore(deps, SOURCE);

    expect(countActive).toHaveBeenCalledTimes(1);
    expect(readSnapshot).not.toHaveBeenCalled();
  });

  it('writes nothing and closes the file', async () => {
    const { deps, io, replaceAll } = setUp();
    io.put(SOURCE, await validArchive());

    await prepareRestore(deps, SOURCE);

    expect(io.created).toEqual([]);
    expect(io.hashedFiles).toEqual([]);
    expect(replaceAll).not.toHaveBeenCalled();
    expect(io.allClosed()).toBe(true);
  });

  it.each([
    ['a PNG', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])],
    ['a text file', encodeUtf8('hola, esto no es un respaldo')],
    ['an empty file', new Uint8Array(0)],
  ])('rejects %s by its content', async (_name, bytes) => {
    const { deps, io } = setUp();
    io.put(SOURCE, bytes);

    await expect(prepareRestore(deps, SOURCE)).resolves.toEqual({
      ok: false,
      error: { code: 'not_a_backup' },
    });
    expect(io.allClosed()).toBe(true);
  });

  it('rejects a ZIP without manifest.json as not a backup', async () => {
    const { deps, io } = setUp();
    io.put(SOURCE, pack([{ name: 'data.json', data: encodeUtf8('{}') }]));

    const result = await prepareRestore(deps, SOURCE);

    expect(result).toEqual({ ok: false, error: { code: 'not_a_backup' } });
  });

  it('rejects a manifest that is not JSON or belongs to another format', async () => {
    const { deps, io } = setUp();
    io.put(SOURCE, pack([{ name: 'manifest.json', data: encodeUtf8('nope') }]));
    expect(await prepareRestore(deps, SOURCE)).toEqual({
      ok: false,
      error: { code: 'not_a_backup' },
    });

    io.put(
      SOURCE,
      pack([{ name: 'manifest.json', data: encodeJson({ format: 'other', formatVersion: 1 }) }]),
    );
    expect(await prepareRestore(deps, SOURCE)).toEqual({
      ok: false,
      error: { code: 'not_a_backup' },
    });
  });

  it('recognises the emergency copy', async () => {
    const { deps, io } = setUp();
    const writer = new MemoryWriter();
    const info = encodeJson({ kind: 'cuantovendi-emergency' });
    await writeStoredArchive(writer, [
      {
        path: 'info.json',
        size: info.length,
        readRange: (o, l) => Promise.resolve(info.slice(o, o + l)),
      },
    ]);
    io.put(SOURCE, writer.toBytes());

    await expect(prepareRestore(deps, SOURCE)).resolves.toEqual({
      ok: false,
      error: { code: 'emergency_backup' },
    });
    expect(io.allClosed()).toBe(true);
  });

  it('reports a newer format version', async () => {
    const { deps, io } = setUp();
    const entries = await entriesOf(await validArchive());
    const manifest = { ...jsonOf(entries[0]?.data ?? new Uint8Array()), formatVersion: 2 };
    io.put(
      SOURCE,
      pack([{ name: 'manifest.json', data: encodeJson(manifest) }, ...entries.slice(1)]),
    );

    await expect(prepareRestore(deps, SOURCE)).resolves.toEqual({
      ok: false,
      error: { code: 'newer_format', formatVersion: 2 },
    });
  });

  it('maps a ZIP the reader refuses to invalid_archive', async () => {
    const { deps, io } = setUp();
    io.put(SOURCE, await validArchive());

    const result = await prepareRestore(
      { ...deps, limits: { ...BACKUP_ZIP_LIMITS, maxEntries: 1 } },
      SOURCE,
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid_archive', reason: 'too_large' },
    });
  });

  it('rejects a file bigger than the archive limit without opening it as a ZIP', async () => {
    const { deps, io } = setUp();
    io.put(SOURCE, await validArchive());

    const result = await prepareRestore(
      { ...deps, limits: { ...BACKUP_ZIP_LIMITS, maxArchiveBytes: 100 } },
      SOURCE,
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid_archive', reason: 'too_large' },
    });
  });

  it('rejects an extra entry that the manifest does not list', async () => {
    const { deps, io } = setUp();
    const entries = await entriesOf(await validArchive());
    const extra = {
      name: `photos/${'a'.repeat(8)}-aaaa-aaaa-aaaa-${'a'.repeat(12)}.jpg`,
      data: PHOTO_BYTES,
    };
    io.put(SOURCE, pack([...entries, extra]));

    await expect(prepareRestore(deps, SOURCE)).resolves.toEqual({
      ok: false,
      error: { code: 'entries_mismatch' },
    });
  });

  it('rejects a missing photo entry', async () => {
    const { deps, io } = setUp();
    const entries = await entriesOf(await validArchive());
    io.put(SOURCE, pack(entries.filter((entry) => !entry.name.startsWith('photos/'))));

    await expect(prepareRestore(deps, SOURCE)).resolves.toEqual({
      ok: false,
      error: { code: 'entries_mismatch' },
    });
  });

  it('rejects a photo whose size differs from the manifest', async () => {
    const { deps, io } = setUp();
    const entries = await entriesOf(await validArchive());
    io.put(
      SOURCE,
      pack(
        entries.map((entry) =>
          entry.name.startsWith('photos/')
            ? { ...entry, data: entry.data.slice(0, entry.data.length - 1) }
            : entry,
        ),
      ),
    );

    await expect(prepareRestore(deps, SOURCE)).resolves.toEqual({
      ok: false,
      error: { code: 'entries_mismatch' },
    });
  });

  it('rejects a data.json whose bytes changed after the manifest was written', async () => {
    const { deps, io } = setUp();
    const entries = await entriesOf(await validArchive());
    io.put(
      SOURCE,
      pack(
        entries.map((entry) => {
          if (entry.name !== 'data.json') {
            return entry;
          }
          const data = entry.data.slice();
          data[data.length - 3] = (data[data.length - 3] ?? 0) ^ 1;
          return { ...entry, data };
        }),
      ),
    );

    await expect(prepareRestore(deps, SOURCE)).resolves.toEqual({
      ok: false,
      error: { code: 'checksum_mismatch', path: 'data.json' },
    });
  });

  it('rejects a corrupted entry by its CRC32', async () => {
    const { deps, io } = setUp();
    const entries = await entriesOf(await validArchive());
    const zip = buildZip(
      entries.map((entry): ZipEntrySpec =>
        entry.name === 'manifest.json'
          ? { name: entry.name, data: entry.data, crc32: 1 }
          : { name: entry.name, data: entry.data },
      ),
    );
    io.put(SOURCE, zip);

    const result = await prepareRestore(deps, SOURCE);

    expect(result).toEqual({
      ok: false,
      error: { code: 'checksum_mismatch', path: 'manifest.json' },
    });
  });

  it('rejects data that does not follow the schema, with the offending path', async () => {
    const { deps, io } = setUp();
    const bytes = await validArchive();
    const entries = await entriesOf(bytes);
    const data = jsonOf(entries[1]?.data ?? new Uint8Array()) as { products: { name: unknown }[] };
    const first = data.products[0];
    if (first !== undefined) {
      first.name = '';
    }
    const dataBytes = encodeJson(data);
    const manifest = jsonOf(entries[0]?.data ?? new Uint8Array()) as {
      files: { path: string; byteSize: number; sha256: string }[];
    };
    const sha = await new InMemoryArchiveIo().sha256OfBytes(dataBytes);
    manifest.files = manifest.files.map((file) =>
      file.path === 'data.json' ? { ...file, byteSize: dataBytes.length, sha256: sha } : file,
    );
    io.put(
      SOURCE,
      pack([
        { name: 'manifest.json', data: encodeJson(manifest) },
        { name: 'data.json', data: dataBytes },
        ...entries.slice(2),
      ]),
    );

    const result = await prepareRestore(deps, SOURCE);

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid_data', issues: ['products.0.name'] },
    });
  });

  it('reports invalid_data at manifest.createdAt when the date is before 1970', async () => {
    const { deps, io } = setUp();
    const entries = await entriesOf(await validArchive());
    const manifest = jsonOf(entries[0]?.data ?? new Uint8Array());
    io.put(
      SOURCE,
      pack([
        {
          name: 'manifest.json',
          data: encodeJson({ ...manifest, createdAt: '1969-12-31T23:59:59.000Z' }),
        },
        ...entries.slice(1),
      ]),
    );

    const result = await prepareRestore(deps, SOURCE);

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid_data', issues: ['manifest.createdAt'] },
    });
  });
});
