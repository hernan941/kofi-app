import { createFileLock } from '@/core/files/file-lock';
import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';
import { epochMsSchema, localDateSchema, type LocalCalendar } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import {
  BACKUP_ZIP_LIMITS,
  backupDataToSnapshot,
  backupDataV1Schema,
  backupManifestV1Schema,
  checkIntegrity,
  checkPhotoFiles,
  decodeUtf8Strict,
  openStoredArchive,
  readVerifiedEntry,
  type ExportProgress,
  type StoredArchive,
  type ZipEntry,
} from '../domain';
import type { DatabaseSnapshot } from '../domain/snapshot';
import { FREE_SPACE_MARGIN_BYTES } from '../domain/space';
import { FakeBackupFiles } from '../testing/fake-backup-files';
import { FakeFileSharer } from '../testing/fake-file-sharer';
import { InMemoryArchiveIo } from '../testing/in-memory-archive-io';
import { richSnapshot } from '../testing/snapshot-fixtures';
import { exportBackup, type ExportBackupDeps } from './export-backup';

const NOW = epochMsSchema.parse(Date.parse('2026-11-13T23:50:00Z'));
const PHOTO_BYTES = Uint8Array.from({ length: 300 }, (_, index) => (index * 3) % 251);
const TARGET = 'file:///fake/cache/backups/cuantovendi-respaldo-2026-11-14.zip';

const calendar: LocalCalendar = {
  localDateOf: () => localDateSchema.parse('2026-11-14'),
  instantAt: () => NOW,
  nextLocalMidnight: () => NOW,
};

function setUp(snapshot: DatabaseSnapshot = richSnapshot()) {
  const fileLock = createFileLock();
  const io = new InMemoryArchiveIo();
  const photos = new InMemoryPhotoStorage();
  const sharer = new FakeFileSharer();
  const backupFiles = new FakeBackupFiles();
  const logger = new RecordingLogger();
  const lockStates: boolean[] = [];
  const photo = snapshot.productPhotos.find((row) => row.deletedAt === null);
  if (photo !== undefined) {
    photos.addFile(photo.id, NOW);
    io.put(photos.uriFor(photo.id), PHOTO_BYTES);
  }
  const deps: ExportBackupDeps = {
    store: {
      readSnapshot: () => {
        lockStates.push(fileLock.isHeld());
        return Promise.resolve(snapshot);
      },
    },
    photos,
    archiveIo: io,
    clock: new FakeClock(NOW),
    logger,
    appVersion: '1.2.3',
    calendar,
    fileLock,
    backupFiles,
    fileSharer: sharer,
  };
  return { deps, fileLock, io, photos, sharer, backupFiles, logger, lockStates, photo };
}

function entryOf(archive: StoredArchive, name: string): ZipEntry {
  const entry = archive.entries.get(name);
  if (entry === undefined) {
    throw new Error(`The entry ${name} is missing.`);
  }
  return entry;
}

function decodeJson(bytes: Uint8Array): unknown {
  const decoded = decodeUtf8Strict(bytes);
  if (!decoded.ok) {
    throw new Error('The bytes are not valid UTF-8.');
  }
  return JSON.parse(decoded.value);
}

describe('exportBackup', () => {
  it('writes the ZIP named after the local date and shares it', async () => {
    const { deps, io, sharer } = setUp();

    const result = await exportBackup(deps, () => undefined);

    expect(result).toEqual({
      ok: true,
      value: { fileName: 'cuantovendi-respaldo-2026-11-14.zip' },
    });
    expect(io.created).toEqual([TARGET]);
    expect(sharer.shared).toEqual([
      { fileUri: TARGET, mimeType: 'application/zip', uti: 'public.zip-archive' },
    ]);
  });

  it('writes manifest.json, data.json and only the active photos, in order', async () => {
    const { deps, io, photo } = setUp();

    await exportBackup(deps, () => undefined);

    const file = await io.openForRead(TARGET);
    const opened = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    expect(opened.ok).toBe(true);
    if (!opened.ok || photo === undefined) {
      return;
    }
    expect([...opened.value.entries.keys()]).toEqual([
      'manifest.json',
      'data.json',
      `photos/${photo.id}.jpg`,
    ]);
    const manifestBytes = await readVerifiedEntry(file, entryOf(opened.value, 'manifest.json'));
    expect(manifestBytes.ok).toBe(true);
    if (manifestBytes.ok) {
      const manifest = backupManifestV1Schema.parse(decodeJson(manifestBytes.value));
      expect(manifest.counts.activePhotos).toBe(1);
      expect(manifest.files.map((entry) => entry.path)).toEqual([
        'data.json',
        `photos/${photo.id}.jpg`,
      ]);
    }
    const photoBytes = await readVerifiedEntry(
      file,
      entryOf(opened.value, `photos/${photo.id}.jpg`),
    );
    expect(photoBytes).toEqual({ ok: true, value: PHOTO_BYTES });
    file.close();
  });

  it('produces a backup that passes the restore validations and returns the same data', async () => {
    const { deps, io, photo } = setUp();
    await exportBackup(deps, () => undefined);

    const file = await io.openForRead(TARGET);
    const opened = await openStoredArchive(file, BACKUP_ZIP_LIMITS);
    if (!opened.ok) {
      throw new Error('The archive should open.');
    }
    const manifestResult = await readVerifiedEntry(file, entryOf(opened.value, 'manifest.json'));
    const dataResult = await readVerifiedEntry(file, entryOf(opened.value, 'data.json'));
    if (!manifestResult.ok || !dataResult.ok) {
      throw new Error('The entries should be readable.');
    }
    const manifest = backupManifestV1Schema.parse(decodeJson(manifestResult.value));
    const data = backupDataV1Schema.parse(decodeJson(dataResult.value));

    expect(checkIntegrity(data, manifest).ok).toBe(true);
    expect(checkPhotoFiles(data, manifest).ok).toBe(true);
    expect(await io.sha256OfBytes(dataResult.value)).toBe(manifest.files[0]?.sha256);
    expect(backupDataToSnapshot(data).products).toEqual(richSnapshot().products);
    expect(photo).toBeDefined();
    file.close();
  });

  it('holds the lock while it reads and releases it afterwards', async () => {
    const { deps, fileLock, lockStates } = setUp();

    await exportBackup(deps, () => undefined);

    expect(lockStates).toEqual([true]);
    expect(fileLock.isHeld()).toBe(false);
  });

  it('releases the lock when reading fails', async () => {
    const { deps, fileLock } = setUp();
    const failing: ExportBackupDeps = {
      ...deps,
      store: { readSnapshot: () => Promise.reject(new Error('read failed')) },
    };

    await expect(exportBackup(failing, () => undefined)).rejects.toThrow('read failed');
    expect(fileLock.isHeld()).toBe(false);
  });

  it('releases the lock when writing fails and closes the writer', async () => {
    const { deps, fileLock, io } = setUp();
    io.failWriteAtCall = 2;

    await expect(exportBackup(deps, () => undefined)).rejects.toThrow('write failed');

    expect(fileLock.isHeld()).toBe(false);
    expect(io.allClosed()).toBe(true);
  });

  it('waits for the file lock when someone else holds it', async () => {
    const { deps, fileLock, io } = setUp();
    const lease = await fileLock.acquire('orphan_collection');

    const pending = exportBackup(deps, () => undefined);
    await Promise.resolve();
    expect(io.created).toEqual([]);
    lease.release();

    await expect(pending).resolves.toMatchObject({ ok: true });
  });

  it('fails with not_enough_space before writing anything', async () => {
    const { deps, io, sharer, fileLock } = setUp();
    io.freeSpace = FREE_SPACE_MARGIN_BYTES;

    const result = await exportBackup(deps, () => undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('not_enough_space');
      expect(result.error).toHaveProperty('requiredBytes');
    }
    expect(io.created).toEqual([]);
    expect(sharer.shared).toEqual([]);
    expect(fileLock.isHeld()).toBe(false);
  });

  it('accepts exactly the required space', async () => {
    const first = setUp();
    first.io.freeSpace = FREE_SPACE_MARGIN_BYTES;
    const refused = await exportBackup(first.deps, () => undefined);
    if (refused.ok || refused.error.code !== 'not_enough_space') {
      throw new Error('Expected not_enough_space.');
    }
    const second = setUp();
    second.io.freeSpace = refused.error.requiredBytes;

    await expect(exportBackup(second.deps, () => undefined)).resolves.toMatchObject({ ok: true });
  });

  it('fails with too_large without writing when the backup could not be restored', async () => {
    const { deps, io, photos, photo, fileLock } = setUp();
    if (photo === undefined) {
      throw new Error('The fixture needs a photo.');
    }
    io.put(photos.uriFor(photo.id), new Uint8Array(BACKUP_ZIP_LIMITS.maxEntryBytes + 1));

    const result = await exportBackup(deps, () => undefined);

    expect(result).toEqual({ ok: false, error: { code: 'too_large' } });
    expect(io.created).toEqual([]);
    expect(fileLock.isHeld()).toBe(false);
  });

  it('reports sharing_unavailable before touching anything', async () => {
    const { deps, io, sharer, lockStates } = setUp();
    sharer.available = false;

    const result = await exportBackup(deps, () => undefined);

    expect(result).toEqual({ ok: false, error: { code: 'sharing_unavailable' } });
    expect(io.created).toEqual([]);
    expect(lockStates).toEqual([]);
  });

  it('shares only after the lock is released', async () => {
    const { deps, fileLock, sharer } = setUp();
    const heldWhenShared: boolean[] = [];
    jest.spyOn(sharer, 'share').mockImplementation(() => {
      heldWhenShared.push(fileLock.isHeld());
      return Promise.resolve();
    });

    await exportBackup(deps, () => undefined);

    expect(heldWhenShared).toEqual([false]);
  });

  it('reports the phases in order', async () => {
    const { deps } = setUp();
    const progress: ExportProgress[] = [];

    await exportBackup(deps, (step) => {
      progress.push(step);
    });

    expect(progress.map((step) => step.phase)).toEqual([
      'reading',
      'hashing_photos',
      'hashing_photos',
      'writing',
      'writing',
      'writing',
      'sharing',
    ]);
    expect(progress.filter((step) => step.phase === 'writing')).toEqual([
      { phase: 'writing', done: 1, total: 3 },
      { phase: 'writing', done: 2, total: 3 },
      { phase: 'writing', done: 3, total: 3 },
    ]);
  });

  it('exports an empty database', async () => {
    const { deps } = setUp({
      products: [],
      productVersions: [],
      productPhotos: [],
      saleRecords: [],
      saleItems: [],
      noSalesWeeks: [],
      tipViews: [],
    });

    await expect(exportBackup(deps, () => undefined)).resolves.toMatchObject({ ok: true });
  });
});
