import { createFileLock } from '@/core/files/file-lock';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import { createDrizzleBackupStore } from '@/features/backup/data/drizzle-backup-store';
import {
  BACKUP_ZIP_LIMITS,
  confirmRestore,
  prepareRestore,
  type RestoreDeps,
} from '@/features/backup';
import { buildBackupArchive } from '@/features/backup/testing/backup-archive-builder';
import { FakeBackupFiles } from '@/features/backup/testing/fake-backup-files';
import { InMemoryArchiveIo } from '@/features/backup/testing/in-memory-archive-io';
import { richSnapshot } from '@/features/backup/testing/snapshot-fixtures';
import { touchesReconcileTables } from '@/features/notifications';
import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';
import { epochMsSchema } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

describe('restoring a backup and the notification reconciliation', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it('asks the reconciler once through DataChanges, without any direct call', async () => {
    const snapshot = richSnapshot();
    const photo = snapshot.productPhotos.find((row) => row.deletedAt === null);
    const io = new InMemoryArchiveIo();
    io.put(
      'file:///source.zip',
      await buildBackupArchive({
        snapshot,
        photos: new Map(photo === undefined ? [] : [[photo.id, new Uint8Array([1, 2, 3])]]),
      }),
    );
    const store = createDrizzleBackupStore({
      db: () => database.db,
      runInTransaction: database.runInTransaction,
      logger: new RecordingLogger(),
    });
    const photos = new InMemoryPhotoStorage();
    const copyRange = io.copyRange.bind(io);
    io.copyRange = async (source, offset, length, target) => {
      await copyRange(source, offset, length, target);
      if (photo !== undefined) {
        photos.addPartial(photo.id, epochMsSchema.parse(1));
      }
    };
    const deps: RestoreDeps = {
      archiveIo: io,
      backupFiles: new FakeBackupFiles(),
      store,
      photos,
      fileLock: createFileLock(),
      clock: new FakeClock(epochMsSchema.parse(1_800_000_000_000)),
      logger: new RecordingLogger(),
      appVersion: '1.0.0',
      limits: BACKUP_ZIP_LIMITS,
      yieldToUi: () => Promise.resolve(),
    };
    const request = jest.fn();
    database.dataChanges.subscribe((tables) => {
      if (touchesReconcileTables(tables)) {
        request();
      }
    });

    const plan = await prepareRestore(deps, 'file:///source.zip');
    expect(request).not.toHaveBeenCalled();
    if (!plan.ok) {
      throw new Error(plan.error.code);
    }
    const result = await confirmRestore(deps, plan.value, () => undefined);

    expect(result.ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
