import { getTableName, isTable } from 'drizzle-orm';

import * as schema from './schema';
import { TABLE_NAMES } from './table-names';

describe('TABLE_NAMES', () => {
  it('lists exactly the tables declared in the Drizzle schema', () => {
    const declared = Object.values(schema)
      .filter((value) => isTable(value))
      .map((table) => getTableName(table))
      .sort();

    expect([...TABLE_NAMES].sort()).toEqual(declared);
  });
});
