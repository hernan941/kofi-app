import { noSalesWeeks } from '@/core/db/schema/no-sales-weeks';
import type { TableName } from '@/core/db/table-names';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import { noSalesWeekIdSchema } from '@/shared/domain';

import { date, epoch, fixtureId } from '../domain/testing/sale-fixtures';
import { createDrizzleNoSalesWeekRepository } from './drizzle-no-sales-week-repository';
import { runNoSalesWeekRepositoryContract } from './no-sales-week-repository.contract';

let database: TestDatabase;
let emitted: ReadonlySet<TableName>[];

async function createHarness() {
  database = await createTestDatabase();
  emitted = [];
  database.dataChanges.subscribe((tables) => {
    emitted.push(tables);
  });
  return {
    repository: createDrizzleNoSalesWeekRepository({
      db: () => database.db,
      runInTransaction: database.runInTransaction,
    }),
    emitted,
    dispose: () => {
      database.close();
    },
  };
}

describe('createDrizzleNoSalesWeekRepository', () => {
  describe('contract', () => {
    runNoSalesWeekRepositoryContract(createHarness);
  });

  describe('Drizzle specifics', () => {
    let harness: Awaited<ReturnType<typeof createHarness>>;
    const id = noSalesWeekIdSchema.parse(fixtureId(5, 1));
    const monday = date('2026-07-06');

    beforeEach(async () => {
      harness = await createHarness();
    });

    afterEach(() => {
      harness.dispose();
    });

    it('keeps a single row per week across mark, unmark and mark again', () => {
      const t = epoch(1_700_000_000_000);
      harness.repository.markSync({ id, weekStart: monday }, t);
      harness.repository.unmarkSync(id, epoch(t + 1));
      harness.repository.markSync({ id, weekStart: monday }, epoch(t + 2));

      expect(database.db.select().from(noSalesWeeks).all()).toEqual([
        { id, weekStart: monday, createdAt: t, updatedAt: t + 2, deletedAt: null },
      ]);
    });

    it('rejects a week_start that is not a Monday', () => {
      expect(() =>
        harness.repository.markSync({ id, weekStart: date('2026-07-07') }, epoch(1)),
      ).toThrow();
      expect(emitted).toEqual([]);
    });
  });
});
