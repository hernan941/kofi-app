import { epochMsSchema, productPhotoIdSchema } from '@/shared/domain';

import { photoRow, productRow, testId } from '../../testing/snapshot-fixtures';
import type { DatabaseSnapshot } from '../snapshot';
import { prepareExportSnapshot, type DiskPhoto } from './export-snapshot';

const NOW = epochMsSchema.parse(1_800_000_000_000);
const photoId = (n: number) => productPhotoIdSchema.parse(testId(3, n));

function snapshotWith(...photos: ReturnType<typeof photoRow>[]): DatabaseSnapshot {
  return {
    products: [productRow(1)],
    productVersions: [],
    productPhotos: photos,
    saleRecords: [],
    saleItems: [],
    noSalesWeeks: [],
    tipViews: [],
  };
}

function disk(
  ...entries: [number, DiskPhoto][]
): ReadonlyMap<ReturnType<typeof photoId>, DiskPhoto> {
  return new Map(entries.map(([n, photo]) => [photoId(n), photo]));
}

describe('prepareExportSnapshot', () => {
  it('keeps a photo whose row matches the disk untouched', () => {
    const row = photoRow(1, 1, { byteSize: 10, sha256: 'b'.repeat(64) });

    const result = prepareExportSnapshot(
      snapshotWith(row),
      disk([1, { byteSize: 10, sha256: 'b'.repeat(64) }]),
      NOW,
    );

    expect(result.snapshot.productPhotos).toEqual([row]);
    expect(result.warnings).toEqual({ hashMismatches: 0, missingFiles: 0 });
  });

  it('uses the hash and the size of the disk when the row differs and counts it', () => {
    const row = photoRow(1, 1, { byteSize: 10, sha256: 'b'.repeat(64) });

    const result = prepareExportSnapshot(
      snapshotWith(row),
      disk([1, { byteSize: 12, sha256: 'c'.repeat(64) }]),
      NOW,
    );

    expect(result.snapshot.productPhotos).toEqual([
      { ...row, byteSize: 12, sha256: 'c'.repeat(64) },
    ]);
    expect(result.warnings).toEqual({ hashMismatches: 1, missingFiles: 0 });
  });

  it('exports an active photo without a file as logically deleted', () => {
    const row = photoRow(1, 1);

    const result = prepareExportSnapshot(snapshotWith(row), disk(), NOW);

    expect(result.snapshot.productPhotos).toEqual([{ ...row, deletedAt: NOW, updatedAt: NOW }]);
    expect(result.warnings).toEqual({ hashMismatches: 0, missingFiles: 1 });
  });

  it('treats an empty file as missing', () => {
    const result = prepareExportSnapshot(
      snapshotWith(photoRow(1, 1)),
      disk([1, { byteSize: 0, sha256: 'd'.repeat(64) }]),
      NOW,
    );

    expect(result.snapshot.productPhotos[0]?.deletedAt).toBe(NOW);
    expect(result.warnings.missingFiles).toBe(1);
  });

  it('leaves logically deleted photos as they are', () => {
    const deleted = photoRow(2, 1, { deletedAt: epochMsSchema.parse(5) });

    const result = prepareExportSnapshot(snapshotWith(deleted), disk(), NOW);

    expect(result.snapshot.productPhotos).toEqual([deleted]);
    expect(result.warnings).toEqual({ hashMismatches: 0, missingFiles: 0 });
  });

  it('does not touch the other tables', () => {
    const snapshot = snapshotWith(photoRow(1, 1));

    const result = prepareExportSnapshot(snapshot, disk(), NOW);

    expect(result.snapshot.products).toBe(snapshot.products);
  });
});
