import { notificationPreferences } from '@/core/db/schema/notification-preferences';
import type { TableName } from '@/core/db/table-names';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import { epochMsSchema } from '@/shared/domain';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { DEFAULT_NOTIFICATION_PREFERENCES } from '../domain/preferences';
import { createDrizzlePreferencesRepository } from './drizzle-preferences-repository';
import { runPreferencesRepositoryContract } from './preferences-repository.contract';

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
    repository: createDrizzlePreferencesRepository({
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

describe('createDrizzlePreferencesRepository', () => {
  describe('contract', () => {
    runPreferencesRepositoryContract(createHarness);
  });

  describe('Drizzle specifics', () => {
    let harness: Awaited<ReturnType<typeof createHarness>>;

    beforeEach(async () => {
      harness = await createHarness();
    });

    afterEach(() => {
      harness.dispose();
    });

    it('stores a single device row with the column values', async () => {
      await harness.repository.save(DEFAULT_NOTIFICATION_PREFERENCES, epochMsSchema.parse(10));
      await harness.repository.save(
        { weekly: { enabled: false, weekday: 2, minuteOfDay: 30 }, monthly: { enabled: true } },
        epochMsSchema.parse(20),
      );

      expect(database.db.select().from(notificationPreferences).all()).toEqual([
        {
          id: 'device',
          weeklyEnabled: 0,
          weeklyWeekday: 2,
          weeklyMinuteOfDay: 30,
          monthlyEnabled: 1,
          updatedAt: 20,
          lastWeeklyFireAt: null,
        },
      ]);
    });

    it('falls back to the defaults and warns on an out-of-range row', async () => {
      database.raw.exec('PRAGMA ignore_check_constraints = ON');
      database.raw.exec(
        "INSERT INTO notification_preferences (id, weekly_enabled, weekly_weekday, weekly_minute_of_day, monthly_enabled, updated_at) VALUES ('device', 1, 9, 5000, 1, 1)",
      );

      await expect(harness.repository.get()).resolves.toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
      expect(logger.entries.map((entry) => entry.event)).toEqual([
        'notification_preferences_invalid_row',
      ]);
    });
  });
});
