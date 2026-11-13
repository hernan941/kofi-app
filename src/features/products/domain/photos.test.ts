import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { epochMsSchema, productPhotoIdSchema, type ProductPhotoId } from '@/shared/domain';

import {
  MAX_PHOTOS_PER_PRODUCT,
  ORPHAN_MIN_AGE_MS,
  PHOTO_JPEG_COMPRESS,
  PHOTO_MAX_SIDE,
  coverPhoto,
  diffPhotos,
  findMissingFiles,
  findOrphans,
  fitSelection,
  fitWithin,
  makeCover,
  movePhoto,
  orderedPhotos,
  remainingPhotoSlots,
  setProductPhotos,
  type PhotoFileInfo,
  type StoredPhoto,
} from './photos';
import type { ProductPhoto } from './product';
import {
  LATER,
  NOW,
  PRODUCT_ID,
  epoch,
  fixtureId,
  makeProduct,
  makeVersion,
} from './testing/product-fixtures';

function photoId(n: number): ProductPhotoId {
  return productPhotoIdSchema.parse(fixtureId(500 + n));
}

function stored(n: number, overrides: Partial<StoredPhoto> = {}): StoredPhoto {
  return {
    id: photoId(n),
    width: 1200,
    height: 1600,
    byteSize: 200_000 + n,
    sha256: n.toString(16).padStart(64, '0'),
    ...overrides,
  };
}

function row(n: number, position: number, overrides: Partial<ProductPhoto> = {}): ProductPhoto {
  return { ...stored(n), productId: PRODUCT_ID, position, ...overrides };
}

function productWith(photos: readonly ProductPhoto[]) {
  return makeProduct([makeVersion(1)], { photos });
}

function file(n: number, modifiedAt: number): PhotoFileInfo {
  return { id: photoId(n), modifiedAt: epoch(modifiedAt) };
}

function idsOf(photos: readonly { readonly id: ProductPhotoId }[]): ProductPhotoId[] {
  return photos.map((photo) => photo.id);
}

describe('constants', () => {
  test('match the decisions of ADR-008 and D-05', () => {
    expect(MAX_PHOTOS_PER_PRODUCT).toBe(6);
    expect(PHOTO_MAX_SIDE).toBe(1600);
    expect(PHOTO_JPEG_COMPRESS).toBe(0.8);
    expect(ORPHAN_MIN_AGE_MS).toBe(15 * 60 * 1000);
  });
});

describe('fitWithin', () => {
  test.each([
    [4000, 3000, { width: 1600, height: 1200 }],
    [3000, 4000, { width: 1200, height: 1600 }],
    [2000, 2000, { width: 1600, height: 1600 }],
    [800, 600, { width: 800, height: 600 }],
    [600, 800, { width: 600, height: 800 }],
    [1600, 1600, { width: 1600, height: 1600 }],
    [1601, 1, { width: 1600, height: 1 }],
    [1, 5000, { width: 1, height: 1600 }],
  ])('%i x %i fits as %o', (width, height, expected) => {
    expect(fitWithin(width, height, 1600)).toEqual(expected);
  });

  test('rounds to the nearest integer', () => {
    expect(fitWithin(4000, 2999, 1600)).toEqual({ width: 1600, height: 1200 });
  });
});

describe('remainingPhotoSlots', () => {
  test.each([
    [0, 6],
    [2, 4],
    [6, 0],
    [7, 0],
  ])('with %i active photos %i slots remain', (active, remaining) => {
    expect(remainingPhotoSlots(active)).toBe(remaining);
  });
});

describe('fitSelection', () => {
  test('keeps the first items up to the slots and returns the rest in order', () => {
    expect(fitSelection(['a', 'b', 'c', 'd'], 2)).toEqual({
      kept: ['a', 'b'],
      dropped: ['c', 'd'],
    });
  });

  test('keeps everything when the selection fits', () => {
    expect(fitSelection(['a', 'b'], 4)).toEqual({ kept: ['a', 'b'], dropped: [] });
  });

  test('drops everything with no slots, and treats negative slots as none', () => {
    expect(fitSelection(['a', 'b'], 0)).toEqual({ kept: [], dropped: ['a', 'b'] });
    expect(fitSelection(['a'], -3)).toEqual({ kept: [], dropped: ['a'] });
  });
});

describe('findOrphans', () => {
  const now = epoch(10_000_000);
  const old = 10_000_000 - ORPHAN_MIN_AGE_MS - 1;

  test('keeps a recent file without a row', () => {
    const files = [file(1, 10_000_000 - 1000)];
    expect(findOrphans(files, new Set(), now, ORPHAN_MIN_AGE_MS)).toEqual([]);
  });

  test('removes an old file without a row', () => {
    expect(findOrphans([file(1, old)], new Set(), now, ORPHAN_MIN_AGE_MS)).toEqual([photoId(1)]);
  });

  test('keeps an old file with an active row', () => {
    expect(findOrphans([file(1, old)], new Set([photoId(1)]), now, ORPHAN_MIN_AGE_MS)).toEqual([]);
  });

  test('removes an old file whose row was soft-deleted (not among the active ids)', () => {
    const files = [file(1, old), file(2, old)];
    expect(findOrphans(files, new Set([photoId(2)]), now, ORPHAN_MIN_AGE_MS)).toEqual([photoId(1)]);
  });

  test('keeps a file exactly at the minimum age', () => {
    const files = [file(1, 10_000_000 - ORPHAN_MIN_AGE_MS)];
    expect(findOrphans(files, new Set(), now, ORPHAN_MIN_AGE_MS)).toEqual([]);
  });

  test('returns nothing when there are no orphans', () => {
    expect(findOrphans([], new Set(), now, ORPHAN_MIN_AGE_MS)).toEqual([]);
  });
});

describe('findMissingFiles', () => {
  test('reports active rows without a file only', () => {
    const active = new Set([photoId(1), photoId(2)]);
    expect(findMissingFiles(active, [file(1, 0)])).toEqual([photoId(2)]);
    expect(findMissingFiles(active, [file(1, 0), file(2, 0)])).toEqual([]);
  });
});

describe('orderedPhotos and coverPhoto', () => {
  test('sort by position, then by id, without mutating the input', () => {
    const photos = [row(3, 2), row(2, 0), row(1, 0)];
    expect(idsOf(orderedPhotos(photos))).toEqual([photoId(1), photoId(2), photoId(3)]);
    expect(idsOf(photos)).toEqual([photoId(3), photoId(2), photoId(1)]);
  });

  test('tolerate gaps in positions', () => {
    const photos = [row(1, 7), row(2, 3)];
    expect(idsOf(orderedPhotos(photos))).toEqual([photoId(2), photoId(1)]);
  });

  test('the cover is the photo with the lowest position', () => {
    expect(coverPhoto(productWith([row(1, 1), row(2, 0)]))?.id).toBe(photoId(2));
  });

  test('the cover of a product without photos is null', () => {
    expect(coverPhoto(productWith([]))).toBeNull();
  });
});

describe('movePhoto and makeCover', () => {
  const list = [row(1, 0), row(2, 1), row(3, 2)];

  test('moves a photo to the given index', () => {
    expect(idsOf(movePhoto(list, photoId(1), 2))).toEqual([photoId(2), photoId(3), photoId(1)]);
    expect(idsOf(movePhoto(list, photoId(3), 1))).toEqual([photoId(1), photoId(3), photoId(2)]);
  });

  test('clamps an index outside the range', () => {
    expect(idsOf(movePhoto(list, photoId(2), 99))).toEqual([photoId(1), photoId(3), photoId(2)]);
    expect(idsOf(movePhoto(list, photoId(2), -4))).toEqual([photoId(2), photoId(1), photoId(3)]);
  });

  test('leaves the list alone when the id is not in it', () => {
    expect(idsOf(movePhoto(list, photoId(9), 0))).toEqual(idsOf(list));
  });

  test('does not mutate the input', () => {
    movePhoto(list, photoId(3), 0);
    expect(idsOf(list)).toEqual([photoId(1), photoId(2), photoId(3)]);
  });

  test('makeCover moves the photo to position 0', () => {
    expect(idsOf(makeCover(list, photoId(3)))).toEqual([photoId(3), photoId(1), photoId(2)]);
  });
});

describe('setProductPhotos', () => {
  const clock = new FakeClock(LATER);

  function value(result: ReturnType<typeof setProductPhotos>) {
    if (!result.ok) {
      throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
    }
    return result.value;
  }

  test('adds photos to a product without any, assigning product id and positions', () => {
    const product = productWith([]);
    const next = value(setProductPhotos(product, [stored(1), stored(2)], clock));
    expect(next.photos).toEqual([row(1, 0), row(2, 1)]);
    expect(next.updatedAt).toBe(LATER);
  });

  test('rejects more than 6 photos', () => {
    const desired = [1, 2, 3, 4, 5, 6, 7].map((n) => stored(n));
    const result = setProductPhotos(productWith([]), desired, clock);
    expect(result).toEqual({ ok: false, error: [{ code: 'too_many_photos', path: ['photos'] }] });
  });

  test('accepts exactly 6 photos', () => {
    const desired = [1, 2, 3, 4, 5, 6].map((n) => stored(n));
    expect(value(setProductPhotos(productWith([]), desired, clock)).photos).toHaveLength(6);
  });

  test('rejects a repeated id, pointing at the repeated entry', () => {
    const result = setProductPhotos(productWith([]), [stored(1), stored(2), stored(1)], clock);
    expect(result).toEqual({
      ok: false,
      error: [{ code: 'duplicate_photo', path: ['photos', 2] }],
    });
  });

  test('reordering renumbers the positions and touches updatedAt', () => {
    const product = productWith([row(1, 0), row(2, 1), row(3, 2)]);
    const next = value(setProductPhotos(product, [stored(3), stored(1), stored(2)], clock));
    expect(next.photos.map((photo) => [photo.id, photo.position])).toEqual([
      [photoId(3), 0],
      [photoId(1), 1],
      [photoId(2), 2],
    ]);
    expect(next.updatedAt).toBe(LATER);
  });

  test('the same list returns the same product, with updatedAt untouched', () => {
    const product = productWith([row(1, 0), row(2, 1)]);
    const next = value(setProductPhotos(product, [stored(1), stored(2)], clock));
    expect(next).toBe(product);
    expect(next.updatedAt).toBe(NOW);
  });

  test('renumbers a product whose stored positions have gaps', () => {
    const product = productWith([row(1, 3), row(2, 9)]);
    const next = value(setProductPhotos(product, [stored(1), stored(2)], clock));
    expect(next.photos.map((photo) => photo.position)).toEqual([0, 1]);
    expect(next.updatedAt).toBe(LATER);
  });

  test('an empty list removes every photo', () => {
    const next = value(setProductPhotos(productWith([row(1, 0)]), [], clock));
    expect(next.photos).toEqual([]);
    expect(next.updatedAt).toBe(LATER);
  });

  test('an existing photo keeps the metadata of its row (photos are immutable)', () => {
    const product = productWith([row(1, 0)]);
    const tampered = stored(1, { width: 10, height: 10, byteSize: 1, sha256: 'f'.repeat(64) });
    const next = value(setProductPhotos(product, [tampered], clock));
    expect(next).toBe(product);
  });

  test('keeps existing photos and adds new ones in the requested order', () => {
    const product = productWith([row(1, 0)]);
    const next = value(setProductPhotos(product, [stored(2), stored(1)], clock));
    expect(next.photos).toEqual([row(2, 0), row(1, 1)]);
  });

  test('never mutates the original product', () => {
    const product = productWith([row(1, 0)]);
    setProductPhotos(product, [], clock);
    expect(product.photos).toEqual([row(1, 0)]);
    expect(epochMsSchema.parse(product.updatedAt)).toBe(NOW);
  });
});

describe('diffPhotos', () => {
  test('is empty when nothing changes', () => {
    const photos = [row(1, 0), row(2, 1)];
    expect(diffPhotos(photos, photos)).toEqual({ inserted: [], moved: [], removed: [] });
  });

  test('reports a new photo as inserted', () => {
    const diff = diffPhotos([row(1, 0)], [row(1, 0), row(2, 1)]);
    expect(diff).toEqual({ inserted: [row(2, 1)], moved: [], removed: [] });
  });

  test('reports a dropped photo as removed', () => {
    const diff = diffPhotos([row(1, 0), row(2, 1)], [row(1, 0)]);
    expect(diff).toEqual({ inserted: [], moved: [], removed: [photoId(2)] });
  });

  test('reports a swap as two moves', () => {
    const diff = diffPhotos([row(1, 0), row(2, 1)], [row(2, 0), row(1, 1)]);
    expect(diff.inserted).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.moved).toEqual(
      expect.arrayContaining([
        { id: photoId(1), position: 1 },
        { id: photoId(2), position: 0 },
      ]),
    );
    expect(diff.moved).toHaveLength(2);
  });

  test('combines insertions, moves and removals', () => {
    const diff = diffPhotos([row(1, 0), row(2, 1)], [row(3, 0), row(2, 1), row(1, 2)]);
    expect(diff.inserted).toEqual([row(3, 0)]);
    expect(diff.moved).toEqual([{ id: photoId(1), position: 2 }]);
    expect(diff.removed).toEqual([]);
  });
});
