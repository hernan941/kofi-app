import { createFileLock } from '@/core/files/file-lock';
import { epochMsSchema, type ProductPhotoId } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { InMemoryPhotoStorage, testPhotoId } from '../testing/in-memory-photo-storage';
import type { PhotoFileDeps } from './photo-file-deps';
import { removePhotoFiles } from './remove-photo-files';

const NOW = epochMsSchema.parse(1_700_000_000_000);

function setup(active: readonly ProductPhotoId[] = []) {
  const photos = new InMemoryPhotoStorage();
  const logger = new RecordingLogger();
  const fileLock = createFileLock();
  const activeIds = new Set(active);
  const deps: PhotoFileDeps = {
    photos,
    products: { activePhotoIds: () => Promise.resolve(activeIds) },
    fileLock,
    clock: new FakeClock(NOW),
    logger,
  };
  return { photos, logger, fileLock, deps, activeIds };
}

describe('removePhotoFiles', () => {
  it('deletes the files that have no active row', async () => {
    const { photos, deps } = setup();
    photos.addFile(testPhotoId(1), NOW);

    await removePhotoFiles(deps, [testPhotoId(1)]);

    expect(photos.hasFile(testPhotoId(1))).toBe(false);
  });

  it('keeps a file whose id has an active row again', async () => {
    const { photos, deps } = setup([testPhotoId(1)]);
    photos.addFile(testPhotoId(1), NOW);

    await removePhotoFiles(deps, [testPhotoId(1)]);

    expect(photos.hasFile(testPhotoId(1))).toBe(true);
  });

  it('releases the lock when it finishes', async () => {
    const { deps, fileLock } = setup();

    await removePhotoFiles(deps, [testPhotoId(1)]);

    expect(fileLock.isHeld()).toBe(false);
  });

  it('waits for a held lock, resolves right away and deletes on release', async () => {
    const { photos, deps, fileLock } = setup();
    photos.addFile(testPhotoId(1), NOW);
    const lease = fileLock.tryAcquire('backup_export');

    await removePhotoFiles(deps, [testPhotoId(1)]);
    expect(photos.hasFile(testPhotoId(1))).toBe(true);

    lease?.release();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(photos.hasFile(testPhotoId(1))).toBe(false);
  });

  it('never rejects and logs each failure while continuing with the rest', async () => {
    const { photos, deps, logger } = setup();
    photos.addFile(testPhotoId(1), NOW);
    photos.addFile(testPhotoId(2), NOW);
    photos.failRemovalOf(testPhotoId(1));

    await expect(removePhotoFiles(deps, [testPhotoId(1), testPhotoId(2)])).resolves.toBeUndefined();

    expect(photos.hasFile(testPhotoId(2))).toBe(false);
    expect(logger.entriesAt('error').map((entry) => entry.event)).toEqual([
      'photo_file_remove_failed',
    ]);
  });

  it('does nothing for an empty list', async () => {
    const { photos, deps } = setup();

    await removePhotoFiles(deps, []);

    expect(photos.operations).toEqual([]);
  });
});
