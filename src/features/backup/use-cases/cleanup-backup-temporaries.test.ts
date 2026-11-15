import { createFileLock } from '@/core/files/file-lock';
import { epochMsSchema } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { FakeBackupFiles } from '../testing/fake-backup-files';
import {
  BACKUP_TEMPORARY_MIN_AGE_MS,
  cleanupBackupTemporaries,
} from './cleanup-backup-temporaries';

const NOW = epochMsSchema.parse(5_000_000);

function setUp() {
  const fileLock = createFileLock();
  const backupFiles = new FakeBackupFiles();
  const logger = new RecordingLogger();
  return {
    fileLock,
    backupFiles,
    logger,
    deps: { backupFiles, fileLock, clock: new FakeClock(NOW), logger },
  };
}

describe('cleanupBackupTemporaries', () => {
  it('sweeps the temporaries older than 15 minutes and reports how many it removed', async () => {
    const { deps, backupFiles } = setUp();
    backupFiles.sweepRemoved = 3;

    const result = await cleanupBackupTemporaries(deps);

    expect(BACKUP_TEMPORARY_MIN_AGE_MS).toBe(900_000);
    expect(backupFiles.sweeps).toEqual([{ now: NOW, minAgeMs: 900_000 }]);
    expect(result).toEqual({ removed: 3 });
  });

  it('holds the lock as backup_cleanup while it sweeps and releases it', async () => {
    const { deps, fileLock, backupFiles } = setUp();
    const owners: (string | null)[] = [];
    jest.spyOn(backupFiles, 'sweep').mockImplementation(() => {
      owners.push(fileLock.tryAcquire('backup_export') === null ? 'held' : null);
      return Promise.resolve({ removed: 0 });
    });

    await cleanupBackupTemporaries(deps);

    expect(owners).toEqual(['held']);
    expect(fileLock.isHeld()).toBe(false);
  });

  it('does nothing when the lock is busy', async () => {
    const { deps, fileLock, backupFiles } = setUp();
    const lease = fileLock.tryAcquire('backup_export');

    const result = await cleanupBackupTemporaries(deps);

    expect(result).toEqual({ removed: 0 });
    expect(backupFiles.sweeps).toEqual([]);
    expect(fileLock.isHeld()).toBe(true);
    lease?.release();
  });

  it('releases the lock when the sweep fails', async () => {
    const { deps, fileLock, backupFiles } = setUp();
    backupFiles.sweepFailure = new Error('sweep failed');

    await expect(cleanupBackupTemporaries(deps)).rejects.toThrow('sweep failed');
    expect(fileLock.isHeld()).toBe(false);
  });
});
