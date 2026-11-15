import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { drizzle } from 'drizzle-orm/better-sqlite3';

import { configureAndMigrate } from '@/core/db/configure-and-migrate';
import { createDataChanges } from '@/core/db/data-changes';
import { configureConnection, type AppDatabase } from '@/core/db/open';
import * as schema from '@/core/db/schema';
import { createBetterSqliteConnection } from '@/core/db/testing/better-sqlite-connection';
import { loadMigrationBundle } from '@/core/db/testing/load-migration-bundle';
import { createRunInTransaction } from '@/core/db/transaction';
import { createDrizzleBackupStore } from '@/features/backup/data/drizzle-backup-store';
import { createDrizzleProductRepository } from '@/features/products/data/drizzle-product-repository';
import { createDrizzleSaleRepository } from '@/features/sales/data/drizzle-sale-repository';
import { addDays, localDateSchema, type ProductId, type SaleRecordId } from '@/shared/domain';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import {
  FIXTURE_LAST_SALE_DAY,
  createLargeFixture,
} from '@/features/e2e/testing/fixture-factories';

const MIGRATIONS_FOLDER = path.join(__dirname, '..', 'db', 'migrations');
const GALLERY_FOLDER = path.join(__dirname, '..', '..', '..', 'e2e', 'maestro', 'assets');
const LONG_TIMEOUT_MS = 120_000;
/**
 * Un `SCAN` sin índice recorre toda la tabla; `SCAN ... USING INDEX` con `LIMIT` (la lista
 * reciente y la fecha más antigua) se detiene en las primeras filas y no cuenta.
 */
const FULL_SCAN = /^SCAN (?!.*USING (COVERING )?INDEX)/;
const GUARDED_TABLES = ['sale_records', 'sale_items'] as const;

interface CapturedStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}

type StatementMethod = 'all' | 'get' | 'run' | 'iterate';
const STATEMENT_METHODS: readonly StatementMethod[] = ['all', 'get', 'run', 'iterate'];

function captureStatements(sqlite: Database.Database, captured: CapturedStatement[]): void {
  const prepare = sqlite.prepare.bind(sqlite);
  jest.spyOn(sqlite, 'prepare').mockImplementation((source: string) => {
    const statement = prepare(source);
    const methods: Record<StatementMethod, (...args: unknown[]) => unknown> = statement;
    for (const method of STATEMENT_METHODS) {
      const original = methods[method].bind(statement);
      methods[method] = (...args: unknown[]) => {
        captured.push({ sql: source, params: args.flat() });
        return original(...args);
      };
    }
    return statement;
  });
}

function planOf(raw: Database.Database, statement: CapturedStatement): string[] {
  return raw
    .prepare(`EXPLAIN QUERY PLAN ${statement.sql}`)
    .all(...statement.params)
    .map((row) => (row as { detail: string }).detail);
}

function fullScansOfSales(details: readonly string[]): string[] {
  return details.filter(
    (detail) =>
      FULL_SCAN.test(detail) && GUARDED_TABLES.some((table) => detail.startsWith(`SCAN ${table}`)),
  );
}

function loadGallery(): Uint8Array[] {
  return ['gallery-1.jpg', 'gallery-2.jpg', 'gallery-3.jpg'].map(
    (name) => new Uint8Array(fs.readFileSync(path.join(GALLERY_FOLDER, name))),
  );
}

describe('hot queries over the large fixture', () => {
  let sqlite: Database.Database;
  let db: AppDatabase;
  let sales: ReturnType<typeof createDrizzleSaleRepository>;
  let products: ReturnType<typeof createDrizzleProductRepository>;
  let productId: ProductId;

  beforeAll(async () => {
    sqlite = new Database(':memory:');
    const raw = createBetterSqliteConnection(sqlite);
    configureConnection(raw);
    db = drizzle(sqlite, { schema });
    const migrated = await configureAndMigrate(raw, db, loadMigrationBundle(MIGRATIONS_FOLDER));
    if (!migrated.ok) {
      throw new Error(`Migration failed: ${migrated.error.kind}`);
    }
    const runInTransaction = createRunInTransaction(db, createDataChanges(new RecordingLogger()));
    const fixture = createLargeFixture(loadGallery());
    const store = createDrizzleBackupStore({
      db: () => db,
      runInTransaction,
      logger: new RecordingLogger(),
    });
    await store.replaceAll(fixture.snapshot);
    const access = { db: () => db, runInTransaction };
    sales = createDrizzleSaleRepository(access);
    products = createDrizzleProductRepository(access);
    const soldItem = fixture.snapshot.saleItems[0];
    if (soldItem === undefined) {
      throw new Error('The large fixture has no sale items.');
    }
    productId = soldItem.productId;
  }, LONG_TIMEOUT_MS);

  afterAll(() => {
    sqlite.close();
  });

  async function plansOf(run: () => Promise<unknown>): Promise<string[]> {
    const captured: CapturedStatement[] = [];
    captureStatements(sqlite, captured);
    await run();
    jest.restoreAllMocks();
    expect(captured.length).toBeGreaterThan(0);
    return captured.flatMap((statement) => planOf(sqlite, statement));
  }

  it('the detector flags a real full scan', () => {
    const details = planOf(sqlite, {
      sql: 'SELECT * FROM sale_items WHERE quantity = ?',
      params: [1],
    });

    expect(fullScansOfSales(details)).toHaveLength(1);
  });

  const lastDay = FIXTURE_LAST_SALE_DAY;
  const monthStart = localDateSchema.parse('2026-10-01');
  const monthEnd = localDateSchema.parse('2026-10-31');
  const weekStart = addDays(lastDay, -6);

  it('home: recent sales and current week', async () => {
    const details = await plansOf(async () => {
      await sales.listRecent(5);
      await sales.listBetween(weekStart, lastDay);
    });

    expect(fullScansOfSales(details)).toEqual([]);
  });

  it('calendar month and monthly summary', async () => {
    const details = await plansOf(async () => {
      await sales.listBetween(monthStart, monthEnd);
      await sales.activeWeekStartsBetween(monthStart, monthEnd);
      await sales.earliestSoldOn();
    });

    expect(fullScansOfSales(details)).toEqual([]);
  });

  it('day detail', async () => {
    const details = await plansOf(async () => {
      await sales.listBetween(lastDay, lastDay);
      await sales.findById('missing' as SaleRecordId);
    });

    expect(fullScansOfSales(details)).toEqual([]);
  });

  it('product list', async () => {
    const details = await plansOf(async () => {
      await products.listActive();
      await products.listArchived();
    });

    expect(fullScansOfSales(details)).toEqual([]);
  });

  it('versionIdsWithSales', async () => {
    const details = await plansOf(async () => {
      await products.versionIdsWithSales(productId);
    });

    expect(fullScansOfSales(details)).toEqual([]);
  });
});
