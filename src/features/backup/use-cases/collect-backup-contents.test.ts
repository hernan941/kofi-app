import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';
import { epochMsSchema, type ProductPhotoId } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import {
  BACKUP_ZIP_LIMITS,
  backupDataV1Schema,
  backupManifestV1Schema,
  decodeUtf8Strict,
  type ExportProgress,
} from '../domain';
import { estimateArchiveBytes } from '../domain/space';
import type { DatabaseSnapshot } from '../domain/snapshot';
import { InMemoryArchiveIo } from '../testing/in-memory-archive-io';
import { richSnapshot } from '../testing/snapshot-fixtures';
import {
  collectBackupContents,
  type BackupContents,
  type BackupContentsDeps,
} from './collect-backup-contents';

const NOW = epochMsSchema.parse(Date.parse('2026-11-13T15:42:10Z'));
const PHOTO_BYTES = Uint8Array.from({ length: 300 }, (_, index) => index % 251);

interface Harness {
  readonly deps: BackupContentsDeps;
  readonly io: InMemoryArchiveIo;
  readonly photos: InMemoryPhotoStorage;
  readonly logger: RecordingLogger;
  readonly progress: ExportProgress[];
  readonly snapshot: DatabaseSnapshot;
}

function decodeJson(bytes: Uint8Array): unknown {
  const decoded = decodeUtf8Strict(bytes);
  if (!decoded.ok) {
    throw new Error('The bytes are not valid UTF-8.');
  }
  return JSON.parse(decoded.value);
}

async function sha256Of(io: InMemoryArchiveIo, bytes: Uint8Array): Promise<string> {
  return io.sha256OfBytes(bytes);
}

function setUp(snapshot: DatabaseSnapshot = richSnapshot()): Harness {
  const io = new InMemoryArchiveIo();
  const photos = new InMemoryPhotoStorage();
  const logger = new RecordingLogger();
  const progress: ExportProgress[] = [];
  const deps: BackupContentsDeps = {
    store: { readSnapshot: () => Promise.resolve(snapshot) },
    photos,
    archiveIo: io,
    clock: new FakeClock(NOW),
    logger,
    appVersion: '1.2.3',
  };
  return { deps, io, photos, logger, progress, snapshot };
}

function putPhotoFile(harness: Harness, id: ProductPhotoId, bytes = PHOTO_BYTES): void {
  harness.photos.addFile(id, NOW);
  harness.io.put(harness.photos.uriFor(id), bytes);
}

async function collect(harness: Harness): Promise<BackupContents> {
  const result = await collectBackupContents(harness.deps, (progress) => {
    harness.progress.push(progress);
  });
  if (!result.ok) {
    throw new Error(`Unexpected error: ${result.error.code}`);
  }
  return result.value;
}

function activePhoto(harness: Harness) {
  const photo = harness.snapshot.productPhotos.find((row) => row.deletedAt === null);
  if (photo === undefined) {
    throw new Error('The fixture needs an active photo.');
  }
  return photo;
}

describe('collectBackupContents', () => {
  it('builds the manifest with the counts and the hashes of what is on disk', async () => {
    const harness = setUp();
    const photo = activePhoto(harness);
    putPhotoFile(harness, photo.id);
    const photoSha = await sha256Of(harness.io, PHOTO_BYTES);

    const contents = await collect(harness);

    const manifest = backupManifestV1Schema.parse(contents.manifest);
    expect(manifest.createdAt).toBe('2026-11-13T15:42:10.000Z');
    expect(manifest.appVersion).toBe('1.2.3');
    expect(manifest.counts).toEqual({ products: 2, saleRecords: 2, activePhotos: 1 });
    expect(manifest.files).toEqual([
      {
        path: 'data.json',
        byteSize: contents.dataBytes.length,
        sha256: await sha256Of(harness.io, contents.dataBytes),
      },
      { path: `photos/${photo.id}.jpg`, byteSize: PHOTO_BYTES.length, sha256: photoSha },
    ]);
    expect(contents.photoFiles).toEqual([
      {
        id: photo.id,
        uri: harness.photos.uriFor(photo.id),
        size: PHOTO_BYTES.length,
        sha256: photoSha,
      },
    ]);
  });

  it('encodes data.json and manifest.json as UTF-8 JSON that matches the manifest', async () => {
    const harness = setUp();
    putPhotoFile(harness, activePhoto(harness).id);

    const contents = await collect(harness);

    const data = backupDataV1Schema.parse(decodeJson(contents.dataBytes));
    expect(data.products.map((row) => row.name)).toContain('Lámina ñandú');
    expect(decodeJson(contents.manifestBytes)).toEqual(contents.manifest);
  });

  it('estimates the size of the archive from its entries', async () => {
    const harness = setUp();
    const photo = activePhoto(harness);
    putPhotoFile(harness, photo.id);

    const contents = await collect(harness);

    expect(contents.estimatedBytes).toBe(
      estimateArchiveBytes([
        { path: 'manifest.json', size: contents.manifestBytes.length },
        { path: 'data.json', size: contents.dataBytes.length },
        { path: `photos/${photo.id}.jpg`, size: PHOTO_BYTES.length },
      ]),
    );
  });

  it('uses the hash of the disk when the row differs and logs a warning without business data', async () => {
    const harness = setUp();
    const photo = activePhoto(harness);
    putPhotoFile(harness, photo.id, Uint8Array.of(1, 2, 3));

    const contents = await collect(harness);

    const diskSha = await sha256Of(harness.io, Uint8Array.of(1, 2, 3));
    expect(contents.photoFiles).toEqual([
      expect.objectContaining({ id: photo.id, size: 3, sha256: diskSha }),
    ]);
    const data = decodeJson(contents.dataBytes) as {
      productPhotos: { id: string; sha256: string; byteSize: number }[];
    };
    expect(data.productPhotos.find((row) => row.id === photo.id)).toMatchObject({
      sha256: diskSha,
      byteSize: 3,
    });
    expect(harness.logger.entriesAt('warn')).toEqual([
      expect.objectContaining({ event: 'backup_photo_hash_mismatch', context: { count: 1 } }),
    ]);
  });

  it('exports an active photo without a file as logically deleted and without a file entry', async () => {
    const harness = setUp();
    const photo = activePhoto(harness);

    const contents = await collect(harness);

    expect(contents.manifest.counts.activePhotos).toBe(0);
    expect(contents.manifest.files.map((file) => file.path)).toEqual(['data.json']);
    expect(contents.photoFiles).toEqual([]);
    const data = decodeJson(contents.dataBytes) as {
      productPhotos: { id: string; deletedAt: number | null }[];
    };
    expect(data.productPhotos.find((row) => row.id === photo.id)?.deletedAt).toBe(NOW);
    expect(harness.logger.entriesAt('warn')).toEqual([
      expect.objectContaining({ event: 'backup_photo_file_missing', context: { count: 1 } }),
    ]);
  });

  it('hashes only the files of active rows and ignores orphan files', async () => {
    const harness = setUp();
    const photo = activePhoto(harness);
    putPhotoFile(harness, photo.id);
    const orphan = harness.snapshot.productPhotos.find((row) => row.deletedAt !== null);
    if (orphan === undefined) {
      throw new Error('The fixture needs a deleted photo.');
    }
    putPhotoFile(harness, orphan.id);

    await collect(harness);

    expect(harness.io.hashedFiles).toEqual([harness.photos.uriFor(photo.id)]);
  });

  it('reports reading, then the hashing of each photo', async () => {
    const harness = setUp();
    putPhotoFile(harness, activePhoto(harness).id);

    await collect(harness);

    expect(harness.progress).toEqual([
      { phase: 'reading' },
      { phase: 'hashing_photos', done: 0, total: 1 },
      { phase: 'hashing_photos', done: 1, total: 1 },
    ]);
  });

  it('writes nothing and leaves every handle closed', async () => {
    const harness = setUp();
    putPhotoFile(harness, activePhoto(harness).id);

    await collect(harness);

    expect(harness.io.created).toEqual([]);
    expect(harness.io.allClosed()).toBe(true);
  });

  it('fails with too_large when a photo exceeds the entry limit', async () => {
    const harness = setUp();
    putPhotoFile(
      harness,
      activePhoto(harness).id,
      new Uint8Array(BACKUP_ZIP_LIMITS.maxEntryBytes + 1),
    );

    const result = await collectBackupContents(harness.deps, () => undefined);

    expect(result).toEqual({ ok: false, error: { code: 'too_large' } });
  });

  it('fails with inconsistent_data, logging the paths, when the data breaks the format', async () => {
    const base = richSnapshot();
    const [first, ...rest] = base.products;
    const harness = setUp({
      ...base,
      products: first === undefined ? [] : [{ ...first, name: '' }, ...rest],
    });

    const result = await collectBackupContents(harness.deps, () => undefined);

    expect(result).toEqual({ ok: false, error: { code: 'inconsistent_data' } });
    const [entry] = harness.logger.entriesAt('error');
    expect(entry?.event).toBe('backup_data_inconsistent');
    expect(entry?.context).toEqual({ issues: ['products.0.name'] });
    expect(harness.io.created).toEqual([]);
  });

  it('fails with inconsistent_data when a sale item points to a missing product', async () => {
    const base = richSnapshot();
    const harness = setUp({ ...base, products: [] });

    const result = await collectBackupContents(harness.deps, () => undefined);

    expect(result).toEqual({ ok: false, error: { code: 'inconsistent_data' } });
    expect(harness.logger.entriesAt('error')).toHaveLength(1);
  });

  it('closes the file when hashing fails', async () => {
    const harness = setUp();
    putPhotoFile(harness, activePhoto(harness).id);
    jest.spyOn(harness.io, 'sha256OfFile').mockRejectedValue(new Error('digest failed'));

    await expect(collectBackupContents(harness.deps, () => undefined)).rejects.toThrow(
      'digest failed',
    );
    expect(harness.io.allClosed()).toBe(true);
  });

  it('exports an empty database as a valid backup', async () => {
    const harness = setUp({
      products: [],
      productVersions: [],
      productPhotos: [],
      saleRecords: [],
      saleItems: [],
      noSalesWeeks: [],
      tipViews: [],
    });

    const contents = await collect(harness);

    expect(contents.manifest.counts).toEqual({ products: 0, saleRecords: 0, activePhotos: 0 });
  });
});
