import Database from 'better-sqlite3';

import { configureConnection, type RawSqliteConnection } from './open';
import { createBetterSqliteConnection } from './testing/better-sqlite-connection';

describe('configureConnection', () => {
  it('leaves foreign keys on and the trusted schema off', () => {
    const database = new Database(':memory:');
    const raw = createBetterSqliteConnection(database);

    configureConnection(raw);

    expect(raw.pragmaValue('PRAGMA foreign_keys')).toBe(1);
    expect(raw.pragmaValue('PRAGMA trusted_schema')).toBe(0);
    database.close();
  });

  it('enables foreign keys even when the engine starts with them off', () => {
    const database = new Database(':memory:');
    database.pragma('foreign_keys = OFF');
    const raw = createBetterSqliteConnection(database);

    configureConnection(raw);

    expect(raw.pragmaValue('PRAGMA foreign_keys')).toBe(1);
    database.close();
  });

  it('throws when foreign keys cannot be enabled', () => {
    const calls: string[] = [];
    const raw: RawSqliteConnection = {
      exec: (sql) => {
        calls.push(sql);
      },
      pragmaValue: () => 0,
    };

    expect(() => {
      configureConnection(raw);
    }).toThrow(/foreign_keys/);
  });
});
