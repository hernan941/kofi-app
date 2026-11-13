import { sql } from 'drizzle-orm';

import { deterministicId } from '@/shared/domain/ids';

import { createTestDatabase, type TestDatabase } from './testing/test-database';

const NOW = '1700000000000';
const HASH = 'a'.repeat(64);

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
});

afterEach(() => {
  database.close();
});

function run(sqlText: string): void {
  database.raw.exec(sqlText);
}

function insertProduct(id = 'p1'): void {
  run(
    `INSERT INTO products (id, name, created_at, updated_at) VALUES ('${id}', 'Taza', ${NOW}, ${NOW})`,
  );
}

function insertVersion(
  options: {
    id?: string;
    mode?: string;
    price?: string;
    cost?: string;
    position?: number;
  } = {},
): void {
  const { id = 'v1', mode = 'fixed', price = '1000', cost = 'NULL', position = 0 } = options;
  run(
    `INSERT INTO product_versions (id, product_id, pricing_mode, price, cost, position, created_at, updated_at) VALUES ('${id}', 'p1', '${mode}', ${price}, ${cost}, ${String(position)}, ${NOW}, ${NOW})`,
  );
}

function insertSaleRecord(options: { id?: string; soldOn?: string; channel?: string } = {}): void {
  const { id = 's1', soldOn = '2026-11-13', channel = 'NULL' } = options;
  const channelValue = channel === 'NULL' ? 'NULL' : `'${channel}'`;
  run(
    `INSERT INTO sale_records (id, sold_on, channel, created_at, updated_at) VALUES ('${id}', '${soldOn}', ${channelValue}, ${NOW}, ${NOW})`,
  );
}

function insertSaleItem(
  options: { id?: string; quantity?: number; unitPrice?: number; unitCost?: string } = {},
): void {
  const { id = 'i1', quantity = 1, unitPrice = 1000, unitCost = 'NULL' } = options;
  run(
    `INSERT INTO sale_items (id, sale_record_id, product_id, product_version_id, quantity, unit_price, unit_cost, position, created_at, updated_at) VALUES ('${id}', 's1', 'p1', 'v1', ${String(quantity)}, ${String(unitPrice)}, ${unitCost}, 0, ${NOW}, ${NOW})`,
  );
}

function insertWeek(id: string, weekStart: string): void {
  run(
    `INSERT INTO no_sales_weeks (id, week_start, created_at, updated_at) VALUES ('${id}', '${weekStart}', ${NOW}, ${NOW})`,
  );
}

function seedSale(): void {
  insertProduct();
  insertVersion();
  insertSaleRecord();
  insertSaleItem();
}

describe('money checks', () => {
  it.each([-1, 1_000_000_000])('rejects a version price of %i', (price) => {
    insertProduct();

    expect(() => {
      insertVersion({ price: String(price) });
    }).toThrow(/CHECK/);
  });

  it('accepts the bounds 0 and 999999999', () => {
    insertProduct();

    expect(() => {
      insertVersion({ id: 'v1', price: '0', cost: '999999999' });
    }).not.toThrow();
  });

  it('rejects an out of range version cost', () => {
    insertProduct();

    expect(() => {
      insertVersion({ cost: '1000000000' });
    }).toThrow(/CHECK/);
  });

  it('rejects out of range unit price and unit cost on items', () => {
    insertProduct();
    insertVersion();
    insertSaleRecord();

    expect(() => {
      insertSaleItem({ unitPrice: -5 });
    }).toThrow(/CHECK/);
    expect(() => {
      insertSaleItem({ id: 'i2', unitCost: '1000000000' });
    }).toThrow(/CHECK/);
  });
});

describe('pricing mode checks', () => {
  beforeEach(() => {
    insertProduct();
  });

  it('rejects an unknown pricing mode', () => {
    expect(() => {
      insertVersion({ mode: 'free' });
    }).toThrow(/CHECK/);
  });

  it('rejects a fixed version without price', () => {
    expect(() => {
      insertVersion({ mode: 'fixed', price: 'NULL' });
    }).toThrow(/CHECK/);
  });

  it('rejects a negotiable version with a price', () => {
    expect(() => {
      insertVersion({ mode: 'negotiable', price: '100' });
    }).toThrow(/CHECK/);
  });

  it('accepts a negotiable version without price', () => {
    expect(() => {
      insertVersion({ mode: 'negotiable', price: 'NULL' });
    }).not.toThrow();
  });
});

describe('numeric checks', () => {
  it.each([0, 10_000])('rejects a quantity of %i', (quantity) => {
    insertProduct();
    insertVersion();
    insertSaleRecord();

    expect(() => {
      insertSaleItem({ quantity });
    }).toThrow(/CHECK/);
  });

  it.each([1, 9_999])('accepts a quantity of %i', (quantity) => {
    insertProduct();
    insertVersion();
    insertSaleRecord();

    expect(() => {
      insertSaleItem({ quantity });
    }).not.toThrow();
  });

  it('rejects a negative position', () => {
    insertProduct();

    expect(() => {
      insertVersion({ position: -1 });
    }).toThrow(/CHECK/);
  });

  it.each([
    ['width', 0, 10, 10, HASH],
    ['height', 10, 0, 10, HASH],
    ['byte_size', 10, 10, 0, HASH],
    ['sha256 length', 10, 10, 10, 'a'.repeat(63)],
    ['sha256 uppercase', 10, 10, 10, 'A'.repeat(64)],
    ['sha256 non hex', 10, 10, 10, 'g'.repeat(64)],
  ])('rejects a photo with invalid %s', (_label, width, height, byteSize, sha) => {
    insertProduct();

    expect(() => {
      run(
        `INSERT INTO product_photos (id, product_id, position, width, height, byte_size, sha256, created_at, updated_at) VALUES ('ph1', 'p1', 0, ${String(width)}, ${String(height)}, ${String(byteSize)}, '${sha}', ${NOW}, ${NOW})`,
      );
    }).toThrow(/CHECK/);
  });

  it('accepts a valid photo', () => {
    insertProduct();

    expect(() => {
      run(
        `INSERT INTO product_photos (id, product_id, position, width, height, byte_size, sha256, created_at, updated_at) VALUES ('ph1', 'p1', 0, 10, 10, 10, '${HASH}', ${NOW}, ${NOW})`,
      );
    }).not.toThrow();
  });
});

describe('date and channel checks', () => {
  it.each(['2026-13-01', '2026-02-30', '2026-1-1', '2026-11-13 ', 'hoy', '20261113'])(
    'rejects sold_on %j',
    (soldOn) => {
      expect(() => {
        insertSaleRecord({ soldOn });
      }).toThrow(/CHECK/);
    },
  );

  it('accepts a well formed sold_on', () => {
    expect(() => {
      insertSaleRecord({ soldOn: '2024-02-29' });
    }).not.toThrow();
  });

  it('rejects an unknown channel and accepts known ones', () => {
    expect(() => {
      insertSaleRecord({ channel: 'telepathy' });
    }).toThrow(/CHECK/);
    expect(() => {
      insertSaleRecord({ id: 's2', channel: 'fair' });
    }).not.toThrow();
    expect(() => {
      insertSaleRecord({ id: 's3' });
    }).not.toThrow();
  });

  it('rejects a week_start that is not a Monday or is malformed', () => {
    expect(() => {
      insertWeek('w1', '2026-11-12');
    }).toThrow(/CHECK/);
    expect(() => {
      insertWeek('w2', '2026-11-1');
    }).toThrow(/CHECK/);
  });

  it('accepts a Monday week_start', () => {
    expect(() => {
      insertWeek('w1', '2026-11-09');
    }).not.toThrow();
  });
});

describe('notification preferences checks', () => {
  function insertPreferences(
    values: {
      id?: string;
      enabled?: number;
      weekday?: number;
      minute?: number;
      monthly?: number;
    } = {},
  ): void {
    const { id = 'device', enabled = 1, weekday = 7, minute = 1200, monthly = 1 } = values;
    run(
      `INSERT INTO notification_preferences (id, weekly_enabled, weekly_weekday, weekly_minute_of_day, monthly_enabled, updated_at) VALUES ('${id}', ${String(enabled)}, ${String(weekday)}, ${String(minute)}, ${String(monthly)}, ${NOW})`,
    );
  }

  it.each([
    ['id', { id: 'other' }],
    ['weekly_enabled', { enabled: 2 }],
    ['monthly_enabled', { monthly: -1 }],
    ['weekday low', { weekday: 0 }],
    ['weekday high', { weekday: 8 }],
    ['minute low', { minute: -1 }],
    ['minute high', { minute: 1440 }],
  ])('rejects an invalid %s', (_label, values) => {
    expect(() => {
      insertPreferences(values);
    }).toThrow(/CHECK/);
  });

  it('accepts the default row and rejects a second one', () => {
    expect(() => {
      insertPreferences();
    }).not.toThrow();
    expect(() => {
      insertPreferences();
    }).toThrow(/UNIQUE|PRIMARY/);
  });
});

describe('no_sales_weeks identity', () => {
  const WEEK = '2026-11-09';

  it('rejects a second row for the same week even with another id', () => {
    insertWeek(deterministicId(WEEK), WEEK);

    expect(() => {
      insertWeek(deterministicId('other'), WEEK);
    }).toThrow(/UNIQUE/);
  });

  it('rejects a repeated deterministic id', () => {
    insertWeek(deterministicId(WEEK), WEEK);

    expect(() => {
      insertWeek(deterministicId(WEEK), '2026-11-16');
    }).toThrow(/UNIQUE|PRIMARY/);
  });

  it('derives the same id for the same week and a different one for another week', () => {
    expect(deterministicId(WEEK)).toBe(deterministicId(WEEK));
    expect(deterministicId(WEEK)).not.toBe(deterministicId('2026-11-16'));
  });

  it('lets a soft deleted week be marked again by clearing deleted_at on the same row', () => {
    const id = deterministicId(WEEK);
    insertWeek(id, WEEK);
    run(`UPDATE no_sales_weeks SET deleted_at = 1700000000001 WHERE id = '${id}'`);

    expect(() => {
      run(`UPDATE no_sales_weeks SET deleted_at = NULL WHERE id = '${id}'`);
    }).not.toThrow();
    expect(
      database.db.all<{ total: number }>(sql`SELECT count(*) AS total FROM no_sales_weeks`),
    ).toEqual([{ total: 1 }]);
  });
});

describe('foreign keys with ON DELETE RESTRICT', () => {
  it('rejects an orphan version', () => {
    expect(() => {
      insertVersion();
    }).toThrow(/FOREIGN KEY/);
  });

  it('rejects deleting a product that has versions', () => {
    insertProduct();
    insertVersion();

    expect(() => {
      run(`DELETE FROM products WHERE id = 'p1'`);
    }).toThrow(/FOREIGN KEY/);
  });

  it('rejects deleting a product that has photos', () => {
    insertProduct();
    run(
      `INSERT INTO product_photos (id, product_id, position, width, height, byte_size, sha256, created_at, updated_at) VALUES ('ph1', 'p1', 0, 10, 10, 10, '${HASH}', ${NOW}, ${NOW})`,
    );

    expect(() => {
      run(`DELETE FROM products WHERE id = 'p1'`);
    }).toThrow(/FOREIGN KEY/);
  });

  it('rejects deleting a record, a version or a product referenced by an item', () => {
    seedSale();

    expect(() => {
      run(`DELETE FROM sale_records WHERE id = 's1'`);
    }).toThrow(/FOREIGN KEY/);
    expect(() => {
      run(`DELETE FROM product_versions WHERE id = 'v1'`);
    }).toThrow(/FOREIGN KEY/);
    expect(() => {
      run(`DELETE FROM products WHERE id = 'p1'`);
    }).toThrow(/FOREIGN KEY/);
  });

  it('rejects an item pointing to a missing record', () => {
    insertProduct();
    insertVersion();

    expect(() => {
      insertSaleItem();
    }).toThrow(/FOREIGN KEY/);
  });
});
