import { createFileLock } from '@/core/files/file-lock';
import { epochMsSchema, type ProductPhotoId } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { ORPHAN_MIN_AGE_MS } from '../domain/photos';
import { InMemoryPhotoStorage, testPhotoId } from '../testing/in-memory-photo-storage';
import { collectOrphanPhotos } from './collect-orphan-photos';
import type { PhotoFileDeps } from './photo-file-deps';

const NOW = epochMsSchema.parse(1_700_000_000_000);
const OLD = epochMsSchema.parse(NOW - ORPHAN_MIN_AGE_MS - 1);
const RECENT = epochMsSchema.parse(NOW - 1000);

function setup(active: readonly ProductPhotoId[] = []) {
  const photos = new InMemoryPhotoStorage();
  const logger = new RecordingLogger();
  const fileLock = createFileLock();
  const deps: PhotoFileDeps = {
    photos,
    products: { activePhotoIds: () => Promise.resolve(new Set(active)) },
    fileLock,
    clock: new FakeClock(NOW),
    logger,
  };
  return { photos, logger, fileLock, deps };
}

describe('collectOrphanPhotos', () => {
  it('deletes only old files without an active row', async () => {
    const { photos, deps } = setup([testPhotoId(1)]);
    photos.addFile(testPhotoId(1), OLD);
    photos.addFile(testPhotoId(2), OLD);
    photos.addFile(testPhotoId(3), RECENT);

    const summary = await collectOrphanPhotos(deps);

    expect(photos.fileIds()).toEqual([testPhotoId(1), testPhotoId(3)]);
    expect(summary).toMatchObject({ kind: 'done', removedFiles: 1, failures: 0 });
  });

  it('deletes old partial files with the same age rule and keeps recent ones', async () => {
    const { photos, deps } = setup();
    photos.addPartial(testPhotoId(1), OLD);
    photos.addPartial(testPhotoId(2), RECENT);

    const summary = await collectOrphanPhotos(deps);

    expect(photos.hasPartial(testPhotoId(1))).toBe(false);
    expect(photos.hasPartial(testPhotoId(2))).toBe(true);
    expect(summary).toMatchObject({ kind: 'done', removedPartials: 1 });
  });

  it('logs the active rows that have no file', async () => {
    const { deps, logger } = setup([testPhotoId(1)]);

    const summary = await collectOrphanPhotos(deps);

    expect(summary).toMatchObject({ kind: 'done', missingFiles: 1 });
    expect(logger.entriesAt('warn')).toEqual([
      expect.objectContaining({ event: 'photo_file_missing', context: { count: 1 } }),
    ]);
  });

  it('is skipped without listing when the lock is held', async () => {
    const { photos, deps, fileLock } = setup();
    fileLock.tryAcquire('backup_restore');

    const summary = await collectOrphanPhotos(deps);

    expect(summary).toEqual({ kind: 'skipped', reason: 'lock_held' });
    expect(photos.operations).toEqual([]);
  });

  it('releases the lock and rejects when listing fails', async () => {
    const { photos, deps, fileLock } = setup();
    photos.failListing(new Error('disk'));

    await expect(collectOrphanPhotos(deps)).rejects.toThrow('disk');

    expect(fileLock.isHeld()).toBe(false);
  });

  it('keeps going when one file cannot be deleted and counts the failure', async () => {
    const { photos, deps } = setup();
    photos.addFile(testPhotoId(1), OLD);
    photos.addFile(testPhotoId(2), OLD);
    photos.failRemovalOf(testPhotoId(1));

    const summary = await collectOrphanPhotos(deps);

    expect(photos.hasFile(testPhotoId(2))).toBe(false);
    expect(summary).toMatchObject({ kind: 'done', removedFiles: 1, failures: 1 });
  });
});
