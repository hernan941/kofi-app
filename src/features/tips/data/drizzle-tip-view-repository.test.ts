import { tipViews } from '@/core/db/schema/tip-views';
import type { TableName } from '@/core/db/table-names';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { at, tipId } from '../domain/testing/tip-fixtures';
import { createDrizzleTipViewRepository } from './drizzle-tip-view-repository';
import { runTipViewRepositoryContract } from './tip-view-repository.contract';

let database: TestDatabase;
let logger: RecordingLogger;

async function createHarness() {
  database = await createTestDatabase();
  logger = new RecordingLogger();
  const emitted: ReadonlySet<TableName>[] = [];
  database.dataChanges.subscribe((tables) => {
    emitted.push(tables);
  });
  return {
    repository: createDrizzleTipViewRepository({
      db: () => database.db,
      runInTransaction: database.runInTransaction,
      logger,
    }),
    emitted,
    dispose: () => {
      database.close();
    },
  };
}

describe('createDrizzleTipViewRepository', () => {
  describe('contract', () => {
    runTipViewRepositoryContract(createHarness);
  });

  describe('Drizzle specifics', () => {
    let harness: Awaited<ReturnType<typeof createHarness>>;

    beforeEach(async () => {
      harness = await createHarness();
    });

    afterEach(() => {
      harness.dispose();
    });

    it('keeps a single row per tip with the stored column values', async () => {
      const id = tipId('costos-tu-tiempo');
      await harness.repository.markSeen(id, at(10));
      await harness.repository.markSeen(id, at(30));
      await harness.repository.markSeen(id, at(20));

      expect(database.db.select().from(tipViews).all()).toEqual([
        { tipId: id, firstSeenAt: 10, updatedAt: 30 },
      ]);
    });

    it('skips a row with an invalid id and logs a warning instead of failing', async () => {
      const valid = tipId('costos-tu-tiempo');
      await harness.repository.markSeen(valid, at(10));
      database.db
        .insert(tipViews)
        .values({ tipId: 'Mal Id', firstSeenAt: at(5), updatedAt: at(5) })
        .run();

      await expect(harness.repository.listAll()).resolves.toEqual([
        { tipId: valid, firstSeenAt: at(10), lastSeenAt: at(10) },
      ]);
      expect(logger.entries).toEqual([
        { level: 'warn', event: 'tip_view_row_discarded', context: { tipId: 'Mal Id' } },
      ]);
    });
  });
});
