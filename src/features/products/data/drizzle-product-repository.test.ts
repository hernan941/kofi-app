import { eq } from 'drizzle-orm';

import { productPhotos } from '@/core/db/schema/product-photos';
import { productVersions } from '@/core/db/schema/product-versions';
import { products } from '@/core/db/schema/products';
import type { TableName } from '@/core/db/table-names';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import { productPhotoIdSchema } from '@/shared/domain';

import type { ProductPhoto } from '../domain';
import {
  PRODUCT_ID,
  clp,
  epoch,
  fixtureId,
  makeProduct,
  makeVersion,
} from '../domain/testing/product-fixtures';
import { createDrizzleProductRepository } from './drizzle-product-repository';
import { runProductRepositoryContract } from './product-repository.contract';
import { insertSale } from './testing/sales-fixtures';

const T1 = epoch(1_700_000_100_000);
const T2 = epoch(1_700_000_200_000);

let database: TestDatabase;
let emitted: ReadonlySet<TableName>[];

async function createRepository() {
  database = await createTestDatabase();
  emitted = [];
  database.dataChanges.subscribe((tables) => {
    emitted.push(tables);
  });
  return createDrizzleProductRepository({
    db: () => database.db,
    runInTransaction: database.runInTransaction,
  });
}

function photo(n: number): ProductPhoto {
  return {
    id: productPhotoIdSchema.parse(fixtureId(600 + n)),
    productId: PRODUCT_ID,
    position: n,
    width: 10,
    height: 20,
    byteSize: 30,
    sha256: 'a'.repeat(64),
  };
}

describe('createDrizzleProductRepository', () => {
  describe('contract', () => {
    let saleCount = 0;
    runProductRepositoryContract(async () => {
      const repository = await createRepository();
      return {
        repository,
        addSale: (seed) => {
          saleCount += 1;
          insertSale(database.db, seed, saleCount);
        },
        dispose: () => {
          database.close();
        },
      };
    });
  });

  describe('Drizzle specifics', () => {
    let repository: Awaited<ReturnType<typeof createRepository>>;

    beforeEach(async () => {
      repository = await createRepository();
    });

    afterEach(() => {
      database.close();
    });

    function versionRow(n: number) {
      return database.db
        .select()
        .from(productVersions)
        .where(eq(productVersions.id, makeVersion(n).id))
        .get();
    }

    it('writes only the changed versions: the untouched one keeps its updated_at', async () => {
      await repository.save(
        makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'B' })]),
      );

      await repository.save(
        makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'B2' })], {
          updatedAt: T1,
        }),
      );

      expect(versionRow(0)?.updatedAt).toBe(epoch(1_700_000_000_000));
      expect(versionRow(1)?.updatedAt).toBe(T1);
    });

    it('soft deletes the removed version and inserts the new one with the product updatedAt', async () => {
      await repository.save(
        makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'B' })]),
      );

      await repository.save(
        makeProduct([makeVersion(0, { name: 'A' }), makeVersion(2, { name: 'C' })], {
          updatedAt: T1,
        }),
      );

      expect(versionRow(1)).toMatchObject({ deletedAt: T1, updatedAt: T1 });
      expect(versionRow(2)).toMatchObject({ deletedAt: null, createdAt: T1, updatedAt: T1 });
    });

    it('maps pricing to pricing_mode and price', async () => {
      await repository.save(
        makeProduct([
          makeVersion(0, { name: 'A', pricing: { mode: 'fixed', price: clp(0) } }),
          makeVersion(1, { name: 'B', pricing: { mode: 'negotiable' } }),
        ]),
      );

      expect(versionRow(0)).toMatchObject({ pricingMode: 'fixed', price: 0 });
      expect(versionRow(1)).toMatchObject({ pricingMode: 'negotiable', price: null });
    });

    it('excludes soft deleted products and reads the photos ordered by position', async () => {
      await repository.save(makeProduct([makeVersion(0)]));
      const photo = {
        id: productPhotoIdSchema.parse(fixtureId(500)),
        productId: PRODUCT_ID,
        position: 0,
        width: 10,
        height: 20,
        byteSize: 30,
        sha256: 'a'.repeat(64),
      };
      database.db
        .insert(productPhotos)
        .values({ ...photo, createdAt: T1, updatedAt: T1, deletedAt: null })
        .run();
      database.db
        .insert(productPhotos)
        .values({
          ...photo,
          id: productPhotoIdSchema.parse(fixtureId(501)),
          position: 1,
          createdAt: T1,
          updatedAt: T1,
          deletedAt: T1,
        })
        .run();

      expect((await repository.findById(PRODUCT_ID))?.photos).toEqual([photo]);

      database.db.update(products).set({ deletedAt: T2 }).where(eq(products.id, PRODUCT_ID)).run();

      await expect(repository.findById(PRODUCT_ID)).resolves.toBeNull();
      await expect(repository.listActive()).resolves.toEqual([]);
      await expect(repository.listArchived()).resolves.toEqual([]);
    });

    describe('DataChanges', () => {
      it('emits products and product_versions once when a version is written', async () => {
        await repository.save(makeProduct([makeVersion(0, { name: 'A' })]));

        expect(emitted).toEqual([new Set(['products', 'product_versions'])]);
      });

      it('emits only products when no version changed', async () => {
        const product = makeProduct([makeVersion(0, { name: 'A' })]);
        await repository.save(product);
        emitted.length = 0;

        await repository.save({ ...product, name: 'Otro', updatedAt: T1 });

        expect(emitted).toEqual([new Set(['products'])]);
      });

      it('emits only products when archiving', async () => {
        await repository.save(makeProduct([makeVersion(0)]));
        emitted.length = 0;

        await repository.setArchived(PRODUCT_ID, T1, T1);

        expect(emitted).toEqual([new Set(['products'])]);
      });

      it('does not emit on reads', async () => {
        await repository.save(makeProduct([makeVersion(0)]));
        emitted.length = 0;
        await repository.listActive();
        await repository.listArchived();
        await repository.findById(PRODUCT_ID);
        await repository.versionIdsWithSales(PRODUCT_ID);
        await repository.findVersionsByIds([makeVersion(0).id]);
        await repository.currentCostsFor([makeVersion(0).id]);
        repository.versionIdsWithSalesSync(PRODUCT_ID);

        expect(emitted).toEqual([]);
      });

      it('joins the outer transaction and emits once after the commit', async () => {
        const product = makeProduct([makeVersion(0, { name: 'A' })]);

        await database.transactions.run(() => {
          repository.saveSync(product);
          repository.setArchivedSync(PRODUCT_ID, T1, T1);
          expect(emitted).toEqual([]);
        });

        expect(emitted).toEqual([new Set(['products', 'product_versions'])]);
      });

      it('emits product_photos only when the photo diff is not empty', async () => {
        await repository.save(makeProduct([makeVersion(0)]));
        emitted.length = 0;

        repository.savePhotosSync(PRODUCT_ID, { inserted: [], moved: [], removed: [] }, T1);
        expect(emitted).toEqual([]);

        repository.savePhotosSync(PRODUCT_ID, { inserted: [photo(0)], moved: [], removed: [] }, T1);
        expect(emitted).toEqual([new Set(['product_photos'])]);
      });

      it('joins the outer transaction and emits products and product_photos once', async () => {
        await database.transactions.run(() => {
          repository.saveSync(makeProduct([makeVersion(0)]));
          repository.savePhotosSync(
            PRODUCT_ID,
            { inserted: [photo(0)], moved: [], removed: [] },
            T1,
          );
          expect(emitted).toEqual([]);
        });

        expect(emitted).toEqual([new Set(['products', 'product_versions', 'product_photos'])]);
      });

      it('rejects an uppercase sha256 with the table check', async () => {
        await repository.save(makeProduct([makeVersion(0)]));

        expect(() => {
          repository.savePhotosSync(
            PRODUCT_ID,
            { inserted: [{ ...photo(0), sha256: 'A'.repeat(64) }], moved: [], removed: [] },
            T1,
          );
        }).toThrow();
      });

      it('emits nothing when the transaction rolls back', async () => {
        await expect(
          database.transactions.run(() => {
            repository.saveSync(makeProduct([makeVersion(0)]));
            throw new Error('boom');
          }),
        ).rejects.toThrow('boom');

        expect(emitted).toEqual([]);
        await expect(repository.findById(PRODUCT_ID)).resolves.toBeNull();
      });
    });
  });
});
