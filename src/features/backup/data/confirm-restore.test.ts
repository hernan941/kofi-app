import { createFileLock } from '@/core/files/file-lock';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import type { TableName } from '@/core/db/table-names';
import { notificationPreferences } from '@/core/db/schema';
import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';
import { epochMsSchema, type ProductPhotoId } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { createDrizzleBackupStore } from './drizzle-backup-store';
import { BACKUP_ZIP_LIMITS, snapshotToBackupData } from '../domain';
import type { RestoreProgress } from '../domain/progress';
import type { DatabaseSnapshot } from '../domain/snapshot';
import { FREE_SPACE_MARGIN_BYTES } from '../domain/space';
import { buildBackupArchive } from '../testing/backup-archive-builder';
import { FakeBackupFiles } from '../testing/fake-backup-files';
import { InMemoryArchiveIo } from '../testing/in-memory-archive-io';
import {
  productRow,
  richSnapshot,
  recordRow,
  itemRow,
  versionRow,
} from '../testing/snapshot-fixtures';
import { confirmRestore } from '../use-cases/confirm-restore';
import { prepareRestore, type RestoreDeps } from '../use-cases/prepare-restore';

const SOURCE = 'file:///fake/cache/DocumentPicker/backup.zip';
const NOW = epochMsSchema.parse(Date.parse('2026-11-13T12:00:00Z'));
const PHOTO_BYTES = Uint8Array.from({ length: 300 }, (_, index) => (index * 7) % 251);

function activePhotoId(snapshot: DatabaseSnapshot): ProductPhotoId {
  const photo = snapshot.productPhotos.find((row) => row.deletedAt === null);
  if (photo === undefined) {
    throw new Error('No active photo.');
  }
  return photo.id;
}

describe('confirmRestore', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  async function setUp(options: { backup?: DatabaseSnapshot } = {}) {
    const backup = options.backup ?? richSnapshot();
    const io = new InMemoryArchiveIo();
    const photos = new InMemoryPhotoStorage();
    const backupFiles = new FakeBackupFiles();
    const fileLock = createFileLock();
    const lockStates: boolean[] = [];
    const store = createDrizzleBackupStore({
      db: () => database.db,
      runInTransaction: database.runInTransaction,
      logger: new RecordingLogger(),
    });
    const realReplaceAll = store.replaceAll.bind(store);
    const deps: RestoreDeps = {
      archiveIo: io,
      backupFiles,
      store: {
        readSnapshot: () => store.readSnapshot(),
        countActive: () => store.countActive(),
        replaceAll: (snapshot) => {
          lockStates.push(fileLock.isHeld());
          return realReplaceAll(snapshot);
        },
      },
      photos,
      fileLock,
      clock: new FakeClock(NOW),
      logger: new RecordingLogger(),
      appVersion: '1.0.0',
      limits: BACKUP_ZIP_LIMITS,
      yieldToUi: () => Promise.resolve(),
    };
    const photoId = activePhotoId(backup);
    const copyRange = io.copyRange.bind(io);
    io.copyRange = async (source, offset, length, targetUri) => {
      await copyRange(source, offset, length, targetUri);
      if (targetUri === photos.partialUriFor(photoId)) {
        photos.addPartial(photoId, NOW);
      }
    };
    const promotePartial = photos.promotePartial.bind(photos);
    photos.promotePartial = async (id) => {
      await promotePartial(id);
      const bytes = io.files.get(photos.partialUriFor(id));
      if (bytes !== undefined) {
        io.put(photos.uriFor(id), bytes);
        io.files.delete(photos.partialUriFor(id));
      }
    };
    io.put(
      SOURCE,
      await buildBackupArchive({ snapshot: backup, photos: new Map([[photoId, PHOTO_BYTES]]) }),
    );
    const prepared = await prepareRestore(deps, SOURCE);
    if (!prepared.ok) {
      throw new Error(`prepare failed: ${prepared.error.code}`);
    }
    return {
      deps,
      io,
      photos,
      backupFiles,
      fileLock,
      lockStates,
      plan: prepared.value,
      photoId,
      store,
    };
  }

  async function seedCurrent(store: { replaceAll(s: DatabaseSnapshot): Promise<void> }) {
    await store.replaceAll({
      products: [productRow(50, { name: 'Actual' })],
      productVersions: [versionRow(50, 50)],
      productPhotos: [],
      saleRecords: [recordRow(50)],
      saleItems: [itemRow(50, 50, 50, 50)],
      noSalesWeeks: [],
      tipViews: [],
    });
  }

  it('replaces the data, copies the photo and reports the safety backup', async () => {
    const { deps, io, photos, plan, photoId, store } = await setUp();
    await seedCurrent(store);

    const result = await confirmRestore(deps, plan, () => undefined);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.copiedPhotos).toBe(1);
    expect(result.value.skippedPhotos).toBe(0);
    expect(photos.hasFile(photoId)).toBe(true);
    expect(photos.hasPartial(photoId)).toBe(false);
    expect(io.files.get(photos.uriFor(photoId))).toEqual(PHOTO_BYTES);
    const stored = await store.readSnapshot();
    expect(snapshotToBackupData(stored)).toEqual(snapshotToBackupData(plan.snapshot));
  });

  it('writes the safety backup first and prunes the old ones only after it is complete', async () => {
    const { deps, io, backupFiles, plan, store } = await setUp();
    await seedCurrent(store);

    const result = await confirmRestore(deps, plan, () => undefined);

    const target = backupFiles.promotedSafety[0];
    expect(target).toBeDefined();
    expect(backupFiles.prunedSafety).toEqual([target?.finalUri]);
    expect(result.ok && result.value.safetyBackup.uri).toBe(target?.finalUri);
    expect(io.files.has(target?.partUri ?? '')).toBe(true);
  });

  it('keeps the previous safety backup when writing the new one fails', async () => {
    const { deps, io, backupFiles, plan, store, photos } = await setUp();
    await seedCurrent(store);
    const before = await store.readSnapshot();
    io.failWriteAtCall = 1;

    await expect(confirmRestore(deps, plan, () => undefined)).rejects.toThrow('write failed');

    expect(backupFiles.promotedSafety).toEqual([]);
    expect(backupFiles.prunedSafety).toEqual([]);
    expect(await store.readSnapshot()).toEqual(before);
    expect(photos.fileIds()).toEqual([]);
  });

  it('checks the free space once, before writing anything', async () => {
    const { deps, io, plan, store, backupFiles } = await setUp();
    await seedCurrent(store);
    io.freeSpace = FREE_SPACE_MARGIN_BYTES;
    const space = jest.spyOn(io, 'availableDiskSpace');

    const result = await confirmRestore(deps, plan, () => undefined);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.code).toBe('not_enough_space');
    expect(
      !result.ok && result.error.code === 'not_enough_space' && result.error.requiredBytes,
    ).toBeGreaterThan(FREE_SPACE_MARGIN_BYTES);
    expect(space).toHaveBeenCalledTimes(1);
    expect(io.created).toEqual([]);
    expect(backupFiles.promotedSafety).toEqual([]);
  });

  it('skips a photo that already exists with the same sha256', async () => {
    const { deps, io, photos, plan, photoId, store } = await setUp();
    await seedCurrent(store);
    photos.addFile(photoId, NOW);
    io.put(photos.uriFor(photoId), PHOTO_BYTES);

    const result = await confirmRestore(deps, plan, () => undefined);

    expect(result.ok && result.value).toMatchObject({ copiedPhotos: 0, skippedPhotos: 1 });
    expect(io.created.some((uri) => uri.endsWith('.jpg.part'))).toBe(false);
  });

  it('aborts with photo_conflict when the photo exists with another sha256, keeping the data', async () => {
    const { deps, io, photos, plan, photoId, store } = await setUp();
    await seedCurrent(store);
    const before = await store.readSnapshot();
    photos.addFile(photoId, NOW);
    io.put(photos.uriFor(photoId), Uint8Array.from([1, 2, 3]));

    const result = await confirmRestore(deps, plan, () => undefined);

    expect(result).toEqual({ ok: false, error: { code: 'photo_conflict', photoId } });
    expect(await store.readSnapshot()).toEqual(before);
    expect(io.files.get(photos.uriFor(photoId))).toEqual(Uint8Array.from([1, 2, 3]));
  });

  it('removes the .part and fails when the copy does not match its sha256', async () => {
    const { deps, io, photos, plan, photoId, store } = await setUp();
    await seedCurrent(store);
    const before = await store.readSnapshot();
    const tampered = {
      ...plan,
      photos: plan.photos.map((photo) => ({ ...photo, sha256: 'f'.repeat(64) })),
    };

    const result = await confirmRestore(deps, tampered, () => undefined);

    expect(result).toEqual({
      ok: false,
      error: { code: 'checksum_mismatch', path: `photos/${photoId}.jpg` },
    });
    expect(photos.hasPartial(photoId)).toBe(false);
    expect(photos.hasFile(photoId)).toBe(false);
    expect(await store.readSnapshot()).toEqual(before);
    expect(io.allClosed()).toBe(true);
  });

  it('holds the file lock while it copies and applies, and releases it always', async () => {
    const { deps, plan, fileLock, lockStates } = await setUp();

    await confirmRestore(deps, plan, () => undefined);

    expect(lockStates).toEqual([true]);
    expect(fileLock.isHeld()).toBe(false);
  });

  it('releases the lock, closes the file and discards the picked copy when it fails', async () => {
    const { deps, io, plan, fileLock, backupFiles } = await setUp();
    io.failWriteAtCall = 1;

    await expect(confirmRestore(deps, plan, () => undefined)).rejects.toThrow();

    expect(fileLock.isHeld()).toBe(false);
    expect(io.allClosed()).toBe(true);
    expect(backupFiles.discarded).toEqual([SOURCE]);
  });

  it('releases the lock and discards the copy even when reporting the last phase throws', async () => {
    const { deps, plan, fileLock, backupFiles } = await setUp();

    await expect(
      confirmRestore(deps, plan, (progress) => {
        if (progress.phase === 'finishing') {
          throw new Error('progress failed');
        }
      }),
    ).rejects.toThrow('progress failed');

    expect(fileLock.isHeld()).toBe(false);
    expect(backupFiles.discarded).toEqual([SOURCE]);
  });

  it('releases the lock and discards the copy even when closing the file throws', async () => {
    const { deps, io, plan, fileLock, backupFiles } = await setUp();
    const openForRead = io.openForRead.bind(io);
    io.openForRead = async (uri) => {
      const file = await openForRead(uri);
      return {
        size: file.size,
        read: (offset, length) => file.read(offset, length),
        close: () => {
          file.close();
          throw new Error('close failed');
        },
      };
    };

    await expect(confirmRestore(deps, plan, () => undefined)).rejects.toThrow('close failed');

    expect(fileLock.isHeld()).toBe(false);
    expect(backupFiles.discarded).toEqual([SOURCE]);
  });

  it('announces all seven tables and never the notification preferences', async () => {
    const { deps, plan } = await setUp();
    const seen: ReadonlySet<TableName>[] = [];
    database.dataChanges.subscribe((tables) => seen.push(tables));

    await confirmRestore(deps, plan, () => undefined);

    expect(seen).toHaveLength(1);
    expect(seen[0]?.size).toBe(7);
    expect(seen[0]?.has('notification_preferences')).toBe(false);
  });

  it('keeps the device notification preferences', async () => {
    const { deps, plan } = await setUp();
    database.db
      .insert(notificationPreferences)
      .values({
        id: 'device',
        weeklyEnabled: 1,
        weeklyWeekday: 2,
        weeklyMinuteOfDay: 540,
        monthlyEnabled: 1,
        updatedAt: epochMsSchema.parse(9),
      })
      .run();

    await confirmRestore(deps, plan, () => undefined);

    expect(database.db.select().from(notificationPreferences).all()).toHaveLength(1);
    expect(database.db.select().from(notificationPreferences).get()?.weeklyWeekday).toBe(2);
  });

  it('rejects a source whose size changed since the preview, before writing anything', async () => {
    const { deps, io, plan, backupFiles } = await setUp();
    io.put(SOURCE, new Uint8Array(plan.archiveSize + 10));

    const result = await confirmRestore(deps, plan, () => undefined);

    expect(result).toEqual({ ok: false, error: { code: 'entries_mismatch' } });
    expect(backupFiles.promotedSafety).toEqual([]);
  });

  it('reports current_data_too_large without writing when the current data cannot be backed up', async () => {
    const { deps, io, photos, plan, store, backupFiles } = await setUp();
    const current = richSnapshot();
    const currentPhoto = current.productPhotos.find((row) => row.deletedAt === null);
    if (currentPhoto === undefined) {
      throw new Error('The fixture needs a photo.');
    }
    await store.replaceAll(current);
    photos.addFile(currentPhoto.id, NOW);
    io.put(photos.uriFor(currentPhoto.id), new Uint8Array(BACKUP_ZIP_LIMITS.maxEntryBytes + 1));

    const result = await confirmRestore(deps, plan, () => undefined);

    expect(result).toEqual({ ok: false, error: { code: 'current_data_too_large' } });
    expect(backupFiles.promotedSafety).toEqual([]);
    expect(await store.readSnapshot()).toEqual(current);
  });

  it('reports every phase in order', async () => {
    const { deps, plan } = await setUp();
    const phases: RestoreProgress['phase'][] = [];

    await confirmRestore(deps, plan, (progress) => {
      if (phases[phases.length - 1] !== progress.phase) {
        phases.push(progress.phase);
      }
    });

    expect(phases).toEqual([
      'checking_space',
      'safety_backup',
      'copying_photos',
      'applying',
      'finishing',
    ]);
  });
});
