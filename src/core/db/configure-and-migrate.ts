import { sql } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

import { err, ok, type Result } from '@/shared/domain/result';

import type * as schema from './schema';
import { enableForeignKeys, type AppDatabase, type RawSqliteConnection } from './open';

/**
 * Journal y SQL empaquetados con la forma de `migrations.js` de drizzle-kit. Sin `readonly`,
 * porque es el tipo que acepta el migrador de Expo.
 */
export interface MigrationBundle {
  journal: {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
  };
  migrations: Record<string, string>;
}

/** Motivo por el que el arranque no puede seguir; la UI lo traduce a un texto amable. */
export type BootFailure =
  | { readonly kind: 'migration_failed'; readonly cause?: unknown }
  | { readonly kind: 'foreign_key_violation'; readonly violations: number }
  | {
      readonly kind: 'newer_database';
      readonly appliedMigrations: number;
      readonly knownMigrations: number;
    };

/** Resultado de migrar al arrancar (ADR-006). */
export type MigrationResult = Result<void, BootFailure>;

interface AppliedMigrations {
  readonly total: number;
  readonly latestCreatedAt: number;
}

/** Cuenta las migraciones aplicadas y la fecha (`created_at`) de la más reciente. */
function readAppliedMigrations(db: AppDatabase): AppliedMigrations {
  const tables = db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'`,
  );
  if (tables.length === 0) {
    return { total: 0, latestCreatedAt: 0 };
  }
  const rows = db.all<{ total: number; latest: number | null }>(
    sql`SELECT count(*) AS total, max(created_at) AS latest FROM __drizzle_migrations`,
  );
  return { total: rows[0]?.total ?? 0, latestCreatedAt: rows[0]?.latest ?? 0 };
}

/**
 * Una base es más nueva que el código si tiene más migraciones que el journal o si su última
 * migración es posterior (`created_at` contra el último `when`) a la última que el código conoce.
 */
function isNewerThanBundle(applied: AppliedMigrations, bundle: MigrationBundle): boolean {
  const entries = bundle.journal.entries;
  const lastKnownWhen = Math.max(0, ...entries.map((entry) => entry.when));
  return applied.total > entries.length || applied.latestCreatedAt > lastKnownWhen;
}

/**
 * Corre las migraciones y verifica las FK con ellas desactivadas. El migrador de Expo solo usa
 * `db.dialect` y `db.session`, que son los mismos en `better-sqlite3`; el `as` cubre únicamente
 * la diferencia nominal del tipo de resultado de `run` (ADR-006).
 */
async function migrateWithForeignKeysOff(
  raw: RawSqliteConnection,
  db: AppDatabase,
  bundle: MigrationBundle,
): Promise<MigrationResult> {
  raw.exec('PRAGMA foreign_keys = OFF');
  try {
    try {
      await migrate(db as ExpoSQLiteDatabase<typeof schema>, bundle);
    } catch (cause) {
      return err({ kind: 'migration_failed', cause });
    }
    const violations = db.all(sql`PRAGMA foreign_key_check`).length;
    return violations > 0 ? err({ kind: 'foreign_key_violation', violations }) : ok(undefined);
  } finally {
    enableForeignKeys(raw);
  }
}

/**
 * Desactiva las FK fuera de transacción, detecta una base más nueva que el código (más
 * migraciones o una última migración posterior al journal),
 * migra con el migrador de Expo, verifica `foreign_key_check` y reactiva las FK.
 * Nunca deja las FK desactivadas al volver.
 */
export async function configureAndMigrate(
  raw: RawSqliteConnection,
  db: AppDatabase,
  bundle: MigrationBundle,
): Promise<MigrationResult> {
  const applied = readAppliedMigrations(db);
  if (isNewerThanBundle(applied, bundle)) {
    return err({
      kind: 'newer_database',
      appliedMigrations: applied.total,
      knownMigrations: bundle.journal.entries.length,
    });
  }
  return migrateWithForeignKeysOff(raw, db, bundle);
}
