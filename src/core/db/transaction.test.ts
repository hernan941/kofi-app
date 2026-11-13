import { sql } from 'drizzle-orm';

import { createTestDatabase, type TestDatabase } from './testing/test-database';
import type { TableName } from './table-names';

const NOW = 1_700_000_000_000;

let database: TestDatabase;
let emitted: ReadonlySet<TableName>[];

beforeEach(async () => {
  database = await createTestDatabase();
  emitted = [];
  database.dataChanges.subscribe((tables) => {
    emitted.push(tables);
  });
});

afterEach(() => {
  database.close();
});

function insertProduct(tx: TestDatabase['db'], id: string): void {
  tx.run(
    sql`INSERT INTO products (id, name, created_at, updated_at) VALUES (${id}, 'Taza', ${NOW}, ${NOW})`,
  );
}

function productCount(): number {
  return (
    database.db.all<{ total: number }>(sql`SELECT count(*) AS total FROM products`)[0]?.total ?? 0
  );
}

describe('runInTransaction', () => {
  it('returns the value of the block and emits the touched tables once after commit', () => {
    const value = database.runInTransaction((tx, touched) => {
      insertProduct(tx, 'p1');
      touched.add('products');
      touched.add('products');
      touched.add('product_versions');
      expect(emitted).toHaveLength(0);
      return 42;
    });

    expect(value).toBe(42);
    expect(productCount()).toBe(1);
    expect(emitted).toEqual([new Set(['products', 'product_versions'])]);
  });

  it('rolls back, rethrows and does not emit when the block fails', () => {
    const failure = new Error('boom');

    expect(() => {
      database.runInTransaction((tx, touched) => {
        insertProduct(tx, 'p1');
        touched.add('products');
        throw failure;
      });
    }).toThrow(failure);

    expect(productCount()).toBe(0);
    expect(emitted).toHaveLength(0);
  });

  it('does not emit when no table was touched', () => {
    database.runInTransaction(() => 1);

    expect(emitted).toHaveLength(0);
  });

  it('joins a nested call to the outer transaction and only the outer one emits', () => {
    database.runInTransaction((tx, touched) => {
      insertProduct(tx, 'p1');
      touched.add('products');
      database.runInTransaction((innerTx, innerTouched) => {
        insertProduct(innerTx, 'p2');
        innerTouched.add('product_versions');
      });
      expect(emitted).toHaveLength(0);
    });

    expect(productCount()).toBe(2);
    expect(emitted).toEqual([new Set(['products', 'product_versions'])]);
  });

  it('rolls back the outer transaction when a nested block fails', () => {
    expect(() => {
      database.runInTransaction((tx, touched) => {
        insertProduct(tx, 'p1');
        touched.add('products');
        database.runInTransaction(() => {
          throw new Error('inner');
        });
      });
    }).toThrow('inner');

    expect(productCount()).toBe(0);
    expect(emitted).toHaveLength(0);
  });

  it('rejects a block that returns a promise, rolling back what it wrote', () => {
    expect(() => {
      // @ts-expect-error async blocks are rejected by the type (ADR-006)
      database.runInTransaction((tx, touched) => {
        insertProduct(tx, 'p1');
        touched.add('products');
        return Promise.resolve(1);
      });
    }).toThrow(/synchronous/);

    expect(productCount()).toBe(0);
    expect(emitted).toHaveLength(0);
  });

  it('rejects a promise returned by a nested block and rolls back the outer one', () => {
    expect(() => {
      database.runInTransaction((tx, touched) => {
        insertProduct(tx, 'p1');
        touched.add('products');
        // @ts-expect-error async blocks are rejected by the type (ADR-006)
        void database.runInTransaction(() => Promise.resolve(1));
      });
    }).toThrow(/synchronous/);

    expect(productCount()).toBe(0);
  });

  it('can run a new transaction after a failed one', () => {
    expect(() => {
      database.runInTransaction(() => {
        throw new Error('first');
      });
    }).toThrow('first');

    database.runInTransaction((tx, touched) => {
      insertProduct(tx, 'p1');
      touched.add('products');
    });

    expect(emitted).toHaveLength(1);
  });
});

describe('transactions runner', () => {
  it('resolves with the value and emits after commit', async () => {
    const value = await database.transactions.run(() => {
      database.runInTransaction((tx, touched) => {
        insertProduct(tx, 'p1');
        touched.add('products');
      });
      return 'done';
    });

    expect(value).toBe('done');
    expect(emitted).toEqual([new Set(['products'])]);
  });

  it('rejects and rolls back everything when the block throws', async () => {
    await expect(
      database.transactions.run(() => {
        database.runInTransaction((tx, touched) => {
          insertProduct(tx, 'p1');
          touched.add('products');
        });
        throw new Error('nope');
      }),
    ).rejects.toThrow('nope');

    expect(productCount()).toBe(0);
    expect(emitted).toHaveLength(0);
  });
});
