import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import type { TransactionRunner } from '@/shared/domain/transaction-runner';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { configureAndMigrate, type MigrationBundle } from '../configure-and-migrate';
import { createDataChanges, type DataChanges } from '../data-changes';
import { configureConnection, type AppDatabase, type RawSqliteConnection } from '../open';
import * as schema from '../schema';
import {
  createRunInTransaction,
  createTransactionRunner,
  type RunInTransaction,
} from '../transaction';
import { createBetterSqliteConnection } from './better-sqlite-connection';
import { loadMigrationBundle } from './load-migration-bundle';

const MIGRATIONS_FOLDER = path.join(__dirname, '..', 'migrations');

/** Base de test con todo lo que reciben los repositorios. */
export interface TestDatabase {
  readonly db: AppDatabase;
  readonly raw: RawSqliteConnection;
  readonly runInTransaction: RunInTransaction;
  readonly transactions: TransactionRunner;
  readonly dataChanges: DataChanges;
  close(): void;
}

/** Opciones de {@link createTestDatabase}. */
export interface TestDatabaseOptions {
  readonly bundle?: MigrationBundle;
  readonly dataChanges?: DataChanges;
}

/**
 * Base `better-sqlite3` en memoria, abierta con `configureConnection` y migrada con
 * `configureAndMigrate`, igual que en la app.
 * @throws {Error} Si la migración falla.
 */
export async function createTestDatabase(options: TestDatabaseOptions = {}): Promise<TestDatabase> {
  const database = new Database(':memory:');
  const raw = createBetterSqliteConnection(database);
  configureConnection(raw);
  const db = drizzle(database, { schema });
  const bundle = options.bundle ?? loadMigrationBundle(MIGRATIONS_FOLDER);
  const result = await configureAndMigrate(raw, db, bundle);
  if (!result.ok) {
    database.close();
    throw new Error(`Test database migration failed: ${result.error.kind}`);
  }
  const dataChanges = options.dataChanges ?? createDataChanges(new RecordingLogger());
  const runInTransaction = createRunInTransaction(db, dataChanges);
  return {
    db,
    raw,
    runInTransaction,
    transactions: createTransactionRunner(runInTransaction),
    dataChanges,
    close: () => {
      database.close();
    },
  };
}
