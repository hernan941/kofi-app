import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { configureConnection, type AppDatabase, type RawSqliteConnection } from './open';
import * as schema from './schema';

/** Nombre del archivo de la base de datos en el dispositivo. */
export const DATABASE_NAME = 'cuantovendi.db';

/** Conexión cruda y base tipada, listas para `configureAndMigrate`. */
export interface AppDatabaseHandle {
  readonly raw: RawSqliteConnection;
  readonly db: AppDatabase;
  /** Base de Expo; solo la usa la copia de la exportación de emergencia (`backupDatabaseAsync`). */
  readonly native: SQLiteDatabase;
}

/** Adapta una base de `expo-sqlite` a la conexión mínima que usan los PRAGMA. */
export function createExpoConnection(sqlite: SQLiteDatabase): RawSqliteConnection {
  return {
    exec: (statement) => {
      sqlite.execSync(statement);
    },
    pragmaValue: (statement) => {
      const row = sqlite.getFirstSync<Record<string, unknown>>(statement);
      return row === null ? undefined : Object.values(row)[0];
    },
  };
}

/** Abre la base de la app con `openDatabaseSync` y la configura; no migra. */
export function openAppDatabase(): AppDatabaseHandle {
  const sqlite = openDatabaseSync(DATABASE_NAME);
  const raw = createExpoConnection(sqlite);
  configureConnection(raw);
  return { raw, db: drizzle(sqlite, { schema }), native: sqlite };
}
