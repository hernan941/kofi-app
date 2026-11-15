import fs from 'node:fs';
import path from 'node:path';

import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import { createFileLock } from '@/core/files/file-lock';
import { InMemoryPhotoStorage } from '@/features/products/testing/in-memory-photo-storage';
import { epochMsSchema, type ProductPhotoId } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { BACKUP_ZIP_LIMITS } from '../domain';
import { FakeBackupFiles } from '../testing/fake-backup-files';
import { InMemoryArchiveIo } from '../testing/in-memory-archive-io';
import { confirmRestore } from '../use-cases/confirm-restore';
import { prepareRestore, type RestoreDeps } from '../use-cases/prepare-restore';
import { createDrizzleBackupStore } from './drizzle-backup-store';

const FIXTURE = path.join(__dirname, '..', '..', '..', '..', 'e2e', 'fixtures', 'basic.zip');
const SOURCE = 'file:///fake/cache/DocumentPicker/basic.zip';
const NOW = epochMsSchema.parse(Date.parse('2026-11-13T12:00:00Z'));

describe('restoring e2e/fixtures/basic.zip through the real flow', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it('prepares and confirms it on the real database and leaves the documented counts', async () => {
    const io = new InMemoryArchiveIo();
    const photos = new InMemoryPhotoStorage();
    const store = createDrizzleBackupStore({
      db: () => database.db,
      runInTransaction: database.runInTransaction,
      logger: new RecordingLogger(),
    });
    const promotePartial = photos.promotePartial.bind(photos);
    photos.promotePartial = async (id) => {
      await promotePartial(id);
      const bytes = io.files.get(photos.partialUriFor(id));
      if (bytes !== undefined) {
        io.put(photos.uriFor(id), bytes);
        io.files.delete(photos.partialUriFor(id));
      }
    };
    const plannedPhotos: ProductPhotoId[] = [];
    const copyRange = io.copyRange.bind(io);
    io.copyRange = async (source, offset, length, targetUri) => {
      await copyRange(source, offset, length, targetUri);
      const photo = plannedPhotos.find((id) => photos.partialUriFor(id) === targetUri);
      if (photo !== undefined) {
        photos.addPartial(photo, NOW);
      }
    };
    const deps: RestoreDeps = {
      archiveIo: io,
      backupFiles: new FakeBackupFiles(),
      store,
      photos,
      fileLock: createFileLock(),
      clock: new FakeClock(NOW),
      logger: new RecordingLogger(),
      appVersion: '1.0.0',
      limits: BACKUP_ZIP_LIMITS,
      yieldToUi: () => Promise.resolve(),
    };
    io.put(SOURCE, new Uint8Array(fs.readFileSync(FIXTURE)));

    const prepared = await prepareRestore(deps, SOURCE);
    if (!prepared.ok) {
      throw new Error(`prepare failed: ${prepared.error.code}`);
    }
    plannedPhotos.push(...prepared.value.photos.map((photo) => photo.id));
    expect(prepared.value.preview).toMatchObject({
      products: 5,
      activePhotos: 2,
      current: { products: 0, saleRecords: 0, activePhotos: 0 },
    });
    const restored = await confirmRestore(deps, prepared.value, () => undefined);

    expect(restored.ok).toBe(true);
    const snapshot = await store.readSnapshot();
    const active = (rows: readonly { readonly deletedAt: unknown }[]) =>
      rows.filter((row) => row.deletedAt === null).length;
    expect(active(snapshot.products)).toBe(5);
    expect(active(snapshot.productPhotos)).toBe(2);
    expect(active(snapshot.saleRecords)).toBe(prepared.value.preview.saleRecords);
    expect(snapshot.saleRecords.length).toBeGreaterThan(0);
    expect(snapshot.noSalesWeeks).toHaveLength(1);
    expect(snapshot.tipViews).toHaveLength(3);
    expect(snapshot.productVersions.length).toBeGreaterThanOrEqual(5);
  });
});
