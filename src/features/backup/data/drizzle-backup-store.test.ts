import { sql } from 'drizzle-orm';

import {
  noSalesWeeks,
  notificationPreferences,
  productPhotos,
  productVersions,
  products,
  saleItems,
  saleRecords,
  tipViews,
} from '@/core/db/schema';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import { epochMsSchema } from '@/shared/domain';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { snapshotToBackupData } from '../domain';
import type { DatabaseSnapshot } from '../domain/snapshot';
import {
  EMPTY_SNAPSHOT,
  itemRow,
  productRow,
  recordRow,
  richSnapshot,
  versionRow,
} from '../testing/snapshot-fixtures';
import { createDrizzleBackupStore } from './drizzle-backup-store';

function insertSnapshot(database: TestDatabase, snapshot: DatabaseSnapshot): void {
  const { db } = database;
  db.transaction((tx) => {
    const insertAll = <T>(rows: readonly T[], run: (batch: T[]) => void) => {
      if (rows.length > 0) {
        run([...rows]);
      }
    };
    insertAll(snapshot.products, (rows) => tx.insert(products).values(rows).run());
    insertAll(snapshot.productVersions, (rows) => tx.insert(productVersions).values(rows).run());
    insertAll(snapshot.productPhotos, (rows) => tx.insert(productPhotos).values(rows).run());
    insertAll(snapshot.saleRecords, (rows) => tx.insert(saleRecords).values(rows).run());
    insertAll(snapshot.saleItems, (rows) => tx.insert(saleItems).values(rows).run());
    insertAll(snapshot.noSalesWeeks, (rows) => tx.insert(noSalesWeeks).values(rows).run());
    insertAll(snapshot.tipViews, (rows) => tx.insert(tipViews).values(rows).run());
  });
}

describe('createDrizzleBackupStore', () => {
  let database: TestDatabase;
  let logger: RecordingLogger;

  beforeEach(async () => {
    database = await createTestDatabase();
    logger = new RecordingLogger();
  });

  afterEach(() => {
    database.close();
  });

  function createStore() {
    return createDrizzleBackupStore({
      db: () => database.db,
      runInTransaction: database.runInTransaction,
      logger,
    });
  }

  it('counts zero active rows in an empty database', async () => {
    await expect(createStore().countActive()).resolves.toEqual({
      products: 0,
      saleRecords: 0,
      activePhotos: 0,
    });
  });

  it('counts only the rows that are not logically deleted, with SQL', async () => {
    const snapshot = richSnapshot();
    insertSnapshot(database, snapshot);
    const active = (rows: readonly { readonly deletedAt: unknown }[]) =>
      rows.filter((row) => row.deletedAt === null).length;
    const store = createStore();
    const readSnapshot = jest.spyOn(store, 'readSnapshot');

    const counts = await store.countActive();

    expect(counts).toEqual({
      products: active(snapshot.products),
      saleRecords: active(snapshot.saleRecords),
      activePhotos: active(snapshot.productPhotos),
    });
    expect(counts.products).toBeLessThan(snapshot.products.length);
    expect(readSnapshot).not.toHaveBeenCalled();
  });

  it('reads an empty database as an empty snapshot', async () => {
    await expect(createStore().readSnapshot()).resolves.toEqual(EMPTY_SNAPSHOT);
  });

  it('reads every table in full, archived and logically deleted rows included', async () => {
    const expected = richSnapshot();
    insertSnapshot(database, expected);

    const snapshot = await createStore().readSnapshot();

    expect(snapshotToBackupData(snapshot)).toEqual(snapshotToBackupData(expected));
    expect(snapshot.products.some((row) => row.deletedAt !== null)).toBe(true);
    expect(snapshot.products.some((row) => row.archivedAt !== null)).toBe(true);
  });

  it('does not announce any change', async () => {
    insertSnapshot(database, richSnapshot());
    const listener = jest.fn();
    database.dataChanges.subscribe(listener);

    await createStore().readSnapshot();

    expect(listener).not.toHaveBeenCalled();
  });

  it('skips and reports a tip view whose id is not valid', async () => {
    insertSnapshot(database, richSnapshot());
    database.db
      .insert(tipViews)
      .values({
        tipId: 'NO VALIDO',
        firstSeenAt: epochMsSchema.parse(1),
        updatedAt: epochMsSchema.parse(1),
      })
      .run();

    const snapshot = await createStore().readSnapshot();

    expect(snapshot.tipViews.map((row) => row.tipId)).toEqual(['primer-consejo']);
    expect(logger.entriesAt('warn').map((entry) => entry.event)).toEqual([
      'backup_invalid_tip_view',
    ]);
  });
});

describe('createDrizzleBackupStore.replaceAll', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  function createStore() {
    return createDrizzleBackupStore({
      db: () => database.db,
      runInTransaction: database.runInTransaction,
      logger: new RecordingLogger(),
    });
  }

  function replacement(): DatabaseSnapshot {
    const rich = richSnapshot();
    return {
      ...rich,
      products: [productRow(9, { name: 'Nuevo' })],
      productVersions: [versionRow(9, 9)],
      productPhotos: [],
      saleRecords: [recordRow(9)],
      saleItems: [itemRow(9, 9, 9, 9)],
      noSalesWeeks: [],
      tipViews: [],
    };
  }

  it('leaves exactly the snapshot in a database that already had data', async () => {
    insertSnapshot(database, richSnapshot());
    const next = replacement();

    await createStore().replaceAll(next);

    const stored = await createStore().readSnapshot();
    expect(snapshotToBackupData(stored)).toEqual(snapshotToBackupData(next));
  });

  it('loads a full snapshot into an empty database and reads it back unchanged', async () => {
    const rich = richSnapshot();

    await createStore().replaceAll(rich);

    const stored = await createStore().readSnapshot();
    expect(snapshotToBackupData(stored)).toEqual(snapshotToBackupData(rich));
  });

  it('inserts in batches when a table has more rows than one statement takes', async () => {
    const rows = Array.from({ length: 450 }, (_, index) => productRow(index + 1));

    await createStore().replaceAll({ ...EMPTY_SNAPSHOT, products: rows });

    expect(database.db.select().from(products).all()).toHaveLength(450);
  });

  it('announces the seven tables once and never notification_preferences', async () => {
    const listener = jest.fn();
    database.dataChanges.subscribe(listener);

    await createStore().replaceAll(richSnapshot());

    expect(listener).toHaveBeenCalledTimes(1);
    expect([...(listener.mock.calls[0] as [ReadonlySet<string>])[0]].sort()).toEqual(
      [
        'no_sales_weeks',
        'product_photos',
        'product_versions',
        'products',
        'sale_items',
        'sale_records',
        'tip_views',
      ].sort(),
    );
  });

  it('keeps the notification preferences and the migration journal', async () => {
    database.db
      .insert(notificationPreferences)
      .values({
        id: 'device',
        weeklyEnabled: 1,
        weeklyWeekday: 3,
        weeklyMinuteOfDay: 600,
        monthlyEnabled: 0,
        updatedAt: epochMsSchema.parse(5),
      })
      .run();
    const preferencesBefore = database.db.select().from(notificationPreferences).all();
    const migrationsBefore = database.db.all(sql`SELECT * FROM __drizzle_migrations`);
    insertSnapshot(database, richSnapshot());

    await createStore().replaceAll(replacement());

    expect(database.db.select().from(notificationPreferences).all()).toEqual(preferencesBefore);
    expect(database.db.all(sql`SELECT * FROM __drizzle_migrations`)).toEqual(migrationsBefore);
  });

  it('leaves no foreign key violation behind', async () => {
    insertSnapshot(database, richSnapshot());

    await createStore().replaceAll(replacement());

    expect(database.db.all(sql`PRAGMA foreign_key_check`)).toEqual([]);
  });

  it('rolls everything back and announces nothing when a row breaks a constraint', async () => {
    insertSnapshot(database, richSnapshot());
    const before = await createStore().readSnapshot();
    const listener = jest.fn();
    database.dataChanges.subscribe(listener);
    const broken: DatabaseSnapshot = {
      ...replacement(),
      saleItems: [itemRow(9, 9, 9, 9, { quantity: 0 })],
    };

    await expect(createStore().replaceAll(broken)).rejects.toThrow();

    expect(await createStore().readSnapshot()).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
  });
});
