import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { InMemoryPhotoStorage } from '../testing/in-memory-photo-storage';
import { importPhotos } from './import-photos';

function setup() {
  const photos = new InMemoryPhotoStorage();
  const logger = new RecordingLogger();
  return { photos, logger, deps: { ids: new SequentialIdGenerator(), photos, logger } };
}

describe('importPhotos', () => {
  it('imports in sequence and reports one outcome per uri', async () => {
    const { photos, deps } = setup();
    photos.failImportOf('b', 'unreadable');

    const outcomes = await importPhotos(deps, ['a', 'b', 'c']);

    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, false, true]);
    expect(outcomes[1]).toEqual({ ok: false, code: 'unreadable' });
    expect(photos.operations).toEqual([
      'import:start:a',
      'import:end:a',
      'import:start:b',
      'import:end:b',
      'import:start:c',
      'import:end:c',
    ]);
    const ids = outcomes.flatMap((outcome) => (outcome.ok ? [outcome.photo.id] : []));
    expect(new Set(ids).size).toBe(2);
  });

  it('reports an unexpected error as write_failed and logs it', async () => {
    const { deps, logger } = setup();
    jest.spyOn(deps.photos, 'importFromPicker').mockRejectedValue(new Error('boom'));
    const outcomes = await importPhotos(deps, ['a']);

    expect(outcomes).toEqual([{ ok: false, code: 'write_failed' }]);
    expect(logger.entriesAt('error')).toHaveLength(1);
  });

  it('reports invalid_id and still consumes the temporary when the generator gives a bad id', async () => {
    const { photos, deps } = setup();
    const badIds = { next: () => 'not-a-uuid' as never };

    const outcomes = await importPhotos({ ...deps, ids: badIds }, ['file:///test/cache/a.jpg']);

    expect(outcomes).toEqual([{ ok: false, code: 'invalid_id' }]);
    expect(photos.deletedSources).toEqual(['file:///test/cache/a.jpg']);
  });
});
