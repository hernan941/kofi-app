import type Database from 'better-sqlite3';

import type { RawSqliteConnection } from '../open';

/** Adapta una base `better-sqlite3` a la conexión mínima que usan los PRAGMA. */
export function createBetterSqliteConnection(database: Database.Database): RawSqliteConnection {
  return {
    exec: (statement) => {
      database.exec(statement);
    },
    pragmaValue: (statement) => database.prepare(statement).pluck().get(),
  };
}
