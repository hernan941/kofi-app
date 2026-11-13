import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Base de datos Drizzle tipada con el esquema de la app.
 * La satisfacen el driver `expo-sqlite` (app) y `better-sqlite3` (tests en Node).
 */
export type AppDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

/** Conexión cruda mínima que necesitan los PRAGMA; la satisfacen expo-sqlite y better-sqlite3. */
export interface RawSqliteConnection {
  exec(sql: string): void;
  /** Ejecuta una sentencia y devuelve el primer valor de la primera fila (`undefined` si no hay). */
  pragmaValue(sql: string): unknown;
}

/**
 * Activa las claves foráneas y verifica con una lectura que quedaron en `1`.
 * @throws {Error} Si el motor no activó las claves foráneas.
 */
export function enableForeignKeys(raw: RawSqliteConnection): void {
  raw.exec('PRAGMA foreign_keys = ON');
  if (raw.pragmaValue('PRAGMA foreign_keys') !== 1) {
    throw new Error('SQLite did not enable foreign_keys; refusing to continue.');
  }
}

/**
 * Configura una conexión recién abierta: `journal_mode = WAL`, `foreign_keys = ON` verificado
 * y `trusted_schema = OFF` (ADR-006). La llaman igual la app y los tests.
 * @throws {Error} Si el motor no activó las claves foráneas.
 */
export function configureConnection(raw: RawSqliteConnection): void {
  raw.exec('PRAGMA journal_mode = WAL');
  enableForeignKeys(raw);
  raw.exec('PRAGMA trusted_schema = OFF');
}
