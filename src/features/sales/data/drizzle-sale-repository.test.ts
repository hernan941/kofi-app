import { eq } from 'drizzle-orm';

import { productVersions } from '@/core/db/schema/product-versions';
import { saleItems } from '@/core/db/schema/sale-items';
import { saleRecords } from '@/core/db/schema/sale-records';
import type { TableName } from '@/core/db/table-names';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import type { Clp, ProductVersionId } from '@/shared/domain';

import {
  LATER,
  NOW,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
  versionId,
} from '../domain/testing/sale-fixtures';
import { createDrizzleSaleRepository } from './drizzle-sale-repository';
import { runSaleRepositoryContract } from './sale-repository.contract';
import { insertCatalogRows } from './testing/insert-catalog-rows';
import { insertSaleRows } from '../testing/insert-sale-rows';

let database: TestDatabase;
let emitted: ReadonlySet<TableName>[];

async function createHarness() {
  database = await createTestDatabase();
  emitted = [];
  database.dataChanges.subscribe((tables) => {
    emitted.push(tables);
  });
  const access = { db: () => database.db, runInTransaction: database.runInTransaction };
  const repository = createDrizzleSaleRepository(access);
  return {
    repository,
    emitted,
    seedCatalog: async () => {
      insertCatalogRows(
        database.db,
        makeProduct(
          1,
          [1, 2, 3, 4, 5, 6].map((n) => makeVersion(n)),
        ),
      );
      insertCatalogRows(
        database.db,
        makeProduct(2, [makeVersion(7, { productN: 2 })], { name: 'Taza' }),
      );
      await Promise.resolve();
    },
    changeVersionCost: async (id: ProductVersionId, cost: Clp | null) => {
      database.db.update(productVersions).set({ cost }).where(eq(productVersions.id, id)).run();
      await Promise.resolve();
    },
    seedRaw: (record: Parameters<typeof insertSaleRows>[1]) => {
      insertSaleRows(database.db, record);
    },
    dispose: () => {
      database.close();
    },
  };
}

describe('createDrizzleSaleRepository', () => {
  describe('contract', () => {
    runSaleRepositoryContract(createHarness);
  });

  describe('Drizzle specifics', () => {
    let harness: Awaited<ReturnType<typeof createHarness>>;

    beforeEach(async () => {
      harness = await createHarness();
      await harness.seedCatalog();
      emitted.length = 0;
    });

    afterEach(() => {
      harness.dispose();
    });

    it('rejects an item whose product does not match its version and writes nothing', () => {
      const bad = makeSaleRecord([
        makeSaleItem(1),
        makeSaleItem(2, { productVersionId: versionId(7) }),
      ]);

      expect(() => {
        harness.repository.saveSync(bad);
      }).toThrow(/product/i);
      expect(database.db.select().from(saleRecords).all()).toEqual([]);
      expect(database.db.select().from(saleItems).all()).toEqual([]);
      expect(emitted).toEqual([]);
    });

    it('keeps updated_at of unchanged items and stamps edited, new and removed ones', () => {
      const original = makeSaleRecord([makeSaleItem(1), makeSaleItem(2), makeSaleItem(3)]);
      harness.repository.saveSync(original);

      harness.repository.saveSync({
        ...original,
        updatedAt: LATER,
        items: [
          makeSaleItem(1),
          makeSaleItem(2, { quantity: 4 }),
          makeSaleItem(4, { position: 2 }),
        ],
      });

      const rows = database.db.select().from(saleItems).all();
      const byId = new Map(rows.map((row) => [row.id, row]));
      expect(byId.get(makeSaleItem(1).id)).toMatchObject({ updatedAt: NOW, deletedAt: null });
      expect(byId.get(makeSaleItem(2).id)).toMatchObject({ updatedAt: LATER, quantity: 4 });
      expect(byId.get(makeSaleItem(3).id)).toMatchObject({ updatedAt: LATER, deletedAt: LATER });
      expect(byId.get(makeSaleItem(4).id)).toMatchObject({ createdAt: LATER, updatedAt: LATER });
    });

    it('soft-deletes the record and its active items', () => {
      const original = makeSaleRecord([makeSaleItem(1)]);
      harness.repository.saveSync(original);

      harness.repository.softDeleteSync(original.id, LATER);

      expect(
        database.db.select().from(saleRecords).where(eq(saleRecords.id, original.id)).get(),
      ).toMatchObject({ deletedAt: LATER });
      expect(database.db.select().from(saleItems).all()).toEqual([
        expect.objectContaining({ deletedAt: LATER }),
      ]);
    });

    it('revives a removed item when a later save brings it back', async () => {
      const original = makeSaleRecord([makeSaleItem(1), makeSaleItem(2)]);
      harness.repository.saveSync(original);
      harness.repository.saveSync({ ...original, updatedAt: LATER, items: [makeSaleItem(1)] });

      harness.repository.saveSync({ ...original, updatedAt: LATER });

      const revived = await harness.repository.findById(original.id);

      expect(revived?.items).toHaveLength(2);
    });
  });
});
