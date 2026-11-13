import path from 'node:path';

import { sql } from 'drizzle-orm';

import { configureAndMigrate, type MigrationBundle } from './configure-and-migrate';
import { createTestDatabase } from './testing/test-database';
import { loadMigrationBundle } from './testing/load-migration-bundle';

const MIGRATIONS_FOLDER = path.join(__dirname, 'migrations');
const APP_TABLES = [
  'no_sales_weeks',
  'notification_preferences',
  'product_photos',
  'product_versions',
  'products',
  'sale_items',
  'sale_records',
  'tip_views',
];

function userTables(database: Awaited<ReturnType<typeof createTestDatabase>>): string[] {
  const rows = database.db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%drizzle%' ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

function appliedCount(database: Awaited<ReturnType<typeof createTestDatabase>>): number {
  const rows = database.db.all<{ total: number }>(
    sql`SELECT count(*) AS total FROM __drizzle_migrations`,
  );
  return rows[0]?.total ?? 0;
}

describe('configureAndMigrate', () => {
  it('builds the current schema on an empty database and leaves foreign keys on', async () => {
    const database = await createTestDatabase();

    expect(userTables(database)).toEqual(APP_TABLES);
    expect(database.raw.pragmaValue('PRAGMA foreign_keys')).toBe(1);
    database.close();
  });

  it('does nothing on a second call', async () => {
    const database = await createTestDatabase();
    const before = appliedCount(database);

    const result = await configureAndMigrate(
      database.raw,
      database.db,
      loadMigrationBundle(MIGRATIONS_FOLDER),
    );

    expect(result).toEqual({ ok: true, value: undefined });
    expect(appliedCount(database)).toBe(before);
    database.close();
  });

  it('fails with a typed error on foreign key violations and leaves foreign keys on', async () => {
    const database = await createTestDatabase();
    database.raw.exec('PRAGMA foreign_keys = OFF');
    database.raw.exec(
      `INSERT INTO product_versions (id, product_id, pricing_mode, price, position, created_at, updated_at) VALUES ('v1', 'missing', 'fixed', 100, 0, 1, 1)`,
    );

    const result = await configureAndMigrate(
      database.raw,
      database.db,
      loadMigrationBundle(MIGRATIONS_FOLDER),
    );

    expect(result).toEqual({ ok: false, error: { kind: 'foreign_key_violation', violations: 1 } });
    expect(database.raw.pragmaValue('PRAGMA foreign_keys')).toBe(1);
    database.close();
  });

  it('fails with newer_database without touching a database migrated beyond the journal', async () => {
    const database = await createTestDatabase();
    database.raw.exec(
      `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('', 9999999999999)`,
    );
    const bundle = loadMigrationBundle(MIGRATIONS_FOLDER);
    const known = bundle.journal.entries.length;
    database.raw.exec('CREATE TABLE sentinel (id INTEGER)');

    const result = await configureAndMigrate(database.raw, database.db, bundle);

    expect(result).toEqual({
      ok: false,
      error: { kind: 'newer_database', appliedMigrations: known + 1, knownMigrations: known },
    });
    expect(database.raw.pragmaValue('PRAGMA foreign_keys')).toBe(1);
    database.close();
  });

  it('fails with newer_database when the applied count matches but the last one is newer than the journal', async () => {
    const database = await createTestDatabase();
    database.raw.exec('UPDATE __drizzle_migrations SET created_at = 9999999999999');
    const bundle = loadMigrationBundle(MIGRATIONS_FOLDER);
    const known = bundle.journal.entries.length;

    const result = await configureAndMigrate(database.raw, database.db, bundle);

    expect(result).toEqual({
      ok: false,
      error: { kind: 'newer_database', appliedMigrations: known, knownMigrations: known },
    });
    database.close();
  });

  it('reports migration_failed and keeps foreign keys on when a migration is broken', async () => {
    const good = loadMigrationBundle(MIGRATIONS_FOLDER);
    const broken: MigrationBundle = {
      journal: {
        entries: [
          ...good.journal.entries,
          {
            idx: good.journal.entries.length,
            when: 9999999999998,
            tag: 'broken',
            breakpoints: true,
          },
        ],
      },
      migrations: {
        ...good.migrations,
        [`m${String(good.journal.entries.length).padStart(4, '0')}`]: 'SELECT * FROM nowhere;',
      },
    };
    const database = await createTestDatabase({ bundle: good });

    const result = await configureAndMigrate(database.raw, database.db, broken);

    expect(result).toMatchObject({ ok: false, error: { kind: 'migration_failed' } });
    expect(database.raw.pragmaValue('PRAGMA foreign_keys')).toBe(1);
    database.close();
  });

  it('migrates from a bundle trimmed to N-1 up to the full bundle', async () => {
    const full = loadMigrationBundle(MIGRATIONS_FOLDER);
    const lastIndex = full.journal.entries.length - 1;
    const previous = loadMigrationBundle(MIGRATIONS_FOLDER, { upToIndex: lastIndex - 1 });
    const database = await createTestDatabase({ bundle: previous });
    expect(appliedCount(database)).toBe(lastIndex);

    const result = await configureAndMigrate(database.raw, database.db, full);

    expect(result.ok).toBe(true);
    expect(appliedCount(database)).toBe(full.journal.entries.length);
    database.close();
  });
});

describe('loadMigrationBundle', () => {
  it('builds a bundle with the same shape as migrations.js', () => {
    const bundle = loadMigrationBundle(MIGRATIONS_FOLDER);

    expect(bundle.journal.entries[0]).toMatchObject({ idx: 0, breakpoints: true });
    expect(Object.keys(bundle.migrations)).toEqual(['m0000']);
    expect(bundle.migrations.m0000).toContain('CREATE TABLE');
  });

  it('trims the journal up to the given index', () => {
    const bundle = loadMigrationBundle(MIGRATIONS_FOLDER, { upToIndex: -1 });

    expect(bundle.journal.entries).toEqual([]);
  });
});
