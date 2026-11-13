import type { TestDatabase } from '@/core/db/testing/test-database';
import type { TableName } from '@/core/db/table-names';
import { productVersionIdSchema, type EpochMs, type ProductId, type Result } from '@/shared/domain';
import { createFileLock } from '@/core/files/file-lock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';

import { InMemoryPhotoStorage, testPhotoId } from '../testing/in-memory-photo-storage';
import { createProductTestContext } from '../data/testing/create-product-test-context';
import { insertSale } from '../data/testing/sales-fixtures';
import type { ProductErrors, StoredPhoto } from '../domain';
import {
  LATER,
  PRODUCT_ID,
  clp,
  makeProduct,
  makeVersion,
} from '../domain/testing/product-fixtures';
import { saveProduct, type SaveProductCommand } from './save-product';
import type { ProductRepository, ProductWriter } from '../data/product-repository';
import type { ProductCommandDeps } from './product-command-deps';

let database: TestDatabase;
let emitted: ReadonlySet<TableName>[];
let repository: ProductRepository & ProductWriter;
let deps: ProductCommandDeps;

const newVersion = (name: string | null) => ({
  name,
  pricing: { mode: 'fixed', price: clp(1000) } as const,
  cost: null,
});

beforeEach(async () => {
  const context = await createProductTestContext();
  ({ database, repository, emitted } = context);
  deps = {
    transactions: database.transactions,
    products: repository,
    clock: new FakeClock(LATER),
    ids: new SequentialIdGenerator(),
    photos: new InMemoryPhotoStorage(),
    fileLock: createFileLock(),
    logger: new RecordingLogger(),
  };
});

afterEach(() => {
  database.close();
});

function savedId(result: Result<ProductId, ProductErrors>): ProductId {
  if (!result.ok) {
    throw new Error('Expected the command to succeed.');
  }
  return result.value;
}

function errorCodes(result: Result<unknown, ProductErrors>): readonly string[] {
  return result.ok ? [] : result.error.map((error) => error.code);
}

describe('saveProduct', () => {
  it('creates the product and returns its id', async () => {
    const result = await saveProduct(deps, {
      kind: 'create',
      input: { name: 'Lámina', description: null, versions: [newVersion(null)] },
    });

    expect(result.ok).toBe(true);
    const stored = await repository.findById(savedId(result));
    expect(stored).toMatchObject({ name: 'Lámina', createdAt: LATER, updatedAt: LATER });
    expect(emitted).toEqual([new Set(['products', 'product_versions'])]);
  });

  it('returns the domain errors without writing or emitting', async () => {
    const result = await saveProduct(deps, {
      kind: 'create',
      input: {
        name: 'Lámina',
        description: null,
        versions: [newVersion(null), newVersion(null)],
      },
    });

    expect(errorCodes(result)).toEqual(['version_name_required', 'version_name_required']);
    await expect(repository.listActive()).resolves.toEqual([]);
    expect(emitted).toEqual([]);
  });

  it('returns product_not_found when updating a missing product', async () => {
    const result = await saveProduct(deps, {
      kind: 'update',
      productId: PRODUCT_ID,
      input: { name: 'X', description: null, versions: [newVersion(null)], removedVersionIds: [] },
    });

    expect(errorCodes(result)).toEqual(['product_not_found']);
    expect(emitted).toEqual([]);
  });

  it('archives a removed version with sales and deletes one without sales', async () => {
    const withSales = makeVersion(1, { name: 'B' });
    const withoutSales = makeVersion(2, { name: 'C' });
    const kept = makeVersion(0, { name: 'A' });
    await repository.save(makeProduct([kept, withSales, withoutSales]));
    insertSale(database.db, { productId: PRODUCT_ID, versionId: withSales.id }, 1);
    emitted.length = 0;

    const result = await saveProduct(deps, {
      kind: 'update',
      productId: PRODUCT_ID,
      input: {
        name: 'Lámina',
        description: null,
        versions: [{ id: kept.id, name: 'A', pricing: kept.pricing, cost: null }],
        removedVersionIds: [withSales.id, withoutSales.id],
      },
    });

    expect(result.ok).toBe(true);
    const stored = await repository.findById(PRODUCT_ID);
    expect(stored?.versions.map((version) => [version.id, version.archivedAt])).toEqual([
      [kept.id, null],
      [withSales.id, LATER],
    ]);
    expect(emitted).toEqual([new Set(['products', 'product_versions'])]);
  });

  it('rejects with the database error and rolls back', async () => {
    const failing: ProductCommandDeps = {
      ...deps,
      products: {
        ...repository,
        saveSync: (product) => {
          repository.saveSync(product);
          throw new Error('disk full');
        },
      },
    };

    await expect(
      saveProduct(failing, {
        kind: 'create',
        input: { name: 'Lámina', description: null, versions: [newVersion(null)] },
      }),
    ).rejects.toThrow('disk full');

    await expect(repository.listActive()).resolves.toEqual([]);
    expect(emitted).toEqual([]);
  });

  it('uses a version id that the generator produced', async () => {
    const result = await saveProduct(deps, {
      kind: 'create',
      input: { name: 'Lámina', description: null, versions: [newVersion(null)] },
    });

    const stored = await repository.findById(savedId(result));
    expect(stored?.versions[0]?.id).toBe(
      productVersionIdSchema.parse('00000000-0000-7000-8000-000000000002'),
    );
  });

  describe('photos', () => {
    const storage = () => deps.photos as InMemoryPhotoStorage;

    function stored(n: number): StoredPhoto {
      const id = testPhotoId(n);
      storage().addFile(id, LATER);
      return { id, width: 100, height: 50, byteSize: 10, sha256: 'b'.repeat(64) };
    }

    const createInput = { name: 'Lámina', description: null, versions: [newVersion(null)] };

    function updateInput(photos?: readonly StoredPhoto[]): SaveProductCommand {
      return {
        kind: 'update',
        productId: PRODUCT_ID,
        input: {
          name: 'Lámina',
          description: null,
          versions: [
            {
              id: makeVersion(0).id,
              name: null,
              pricing: makeVersion(0).pricing,
              cost: null,
            },
          ],
          removedVersionIds: [],
        },
        ...(photos === undefined ? {} : { photos }),
      };
    }

    it('inserts the rows of two new photos in the same transaction as the product', async () => {
      const result = await saveProduct(deps, {
        kind: 'create',
        input: createInput,
        photos: [stored(1), stored(2)],
      });

      const product = await repository.findById(savedId(result));
      expect(product?.photos.map((photo) => [photo.id, photo.position])).toEqual([
        [testPhotoId(1), 0],
        [testPhotoId(2), 1],
      ]);
      expect(emitted).toEqual([new Set(['products', 'product_versions', 'product_photos'])]);
    });

    it('keeps the new files and rethrows the original error when the transaction fails', async () => {
      const failing: ProductCommandDeps = {
        ...deps,
        products: {
          ...repository,
          savePhotosSync: () => {
            throw new Error('disk full');
          },
        },
      };
      storage().addFile(testPhotoId(1), 0 as EpochMs);
      storage().addFile(testPhotoId(2), 0 as EpochMs);

      await expect(
        saveProduct(failing, {
          kind: 'create',
          input: createInput,
          photos: [stored(1), stored(2)],
        }),
      ).rejects.toThrow('disk full');

      expect(storage().hasFile(testPhotoId(1))).toBe(true);
      expect(storage().hasFile(testPhotoId(2))).toBe(true);
      expect(storage().operations.filter((operation) => operation.startsWith('remove:'))).toEqual(
        [],
      );
      await expect(repository.listActive()).resolves.toEqual([]);
      expect(emitted).toEqual([]);
    });

    it('soft deletes a removed photo and deletes its file after the commit', async () => {
      await repository.save(makeProduct([makeVersion(0)]));
      const kept = stored(1);
      const removed = stored(2);
      await saveProduct(deps, updateInput([kept, removed]));
      storage().operations.length = 0;
      emitted.length = 0;

      const result = await saveProduct(deps, updateInput([kept]));

      expect(result.ok).toBe(true);
      expect((await repository.findById(PRODUCT_ID))?.photos.map((photo) => photo.id)).toEqual([
        kept.id,
      ]);
      expect(emitted).toEqual([new Set(['products', 'product_photos'])]);
      expect(storage().operations).toEqual([`remove:${removed.id}`]);
      expect(storage().hasFile(removed.id)).toBe(false);
      expect(storage().hasFile(kept.id)).toBe(true);
    });

    it('keeps the removed file until the lock is released', async () => {
      await repository.save(makeProduct([makeVersion(0)]));
      const photo = stored(1);
      await saveProduct(deps, updateInput([photo]));
      const lease = deps.fileLock.tryAcquire('backup_export');

      await saveProduct(deps, updateInput([]));
      expect(storage().hasFile(photo.id)).toBe(true);

      lease?.release();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(storage().hasFile(photo.id)).toBe(false);
    });

    it('does not write, emit or delete files on a domain error', async () => {
      const seven = [1, 2, 3, 4, 5, 6, 7].map(stored);

      const result = await saveProduct(deps, {
        kind: 'create',
        input: createInput,
        photos: seven,
      });

      expect(errorCodes(result)).toEqual(['too_many_photos']);
      expect(emitted).toEqual([]);
      expect(storage().fileIds()).toHaveLength(7);
    });

    it('never goes above six active photos', async () => {
      await repository.save(makeProduct([makeVersion(0)]));
      const six = [1, 2, 3, 4, 5, 6].map(stored);
      await saveProduct(deps, updateInput(six));

      const result = await saveProduct(deps, updateInput([...six, stored(7)]));

      expect(errorCodes(result)).toEqual(['too_many_photos']);
      expect((await repository.findById(PRODUCT_ID))?.photos).toHaveLength(6);
    });

    it('does not touch the photos when the command has none', async () => {
      await repository.save(makeProduct([makeVersion(0)]));
      await saveProduct(deps, updateInput([stored(1)]));

      await saveProduct(deps, updateInput());

      expect((await repository.findById(PRODUCT_ID))?.photos).toHaveLength(1);
    });
  });
});
