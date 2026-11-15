import { getTableColumns, getTableName, type Table } from 'drizzle-orm';

import {
  noSalesWeeks,
  productPhotos,
  productVersions,
  products,
  saleItems,
  saleRecords,
  tipViews,
} from '@/core/db/schema';

import { SNAPSHOT_COLUMNS, type SnapshotTable } from '../domain/snapshot';

const TABLES: readonly Table[] = [
  products,
  productVersions,
  productPhotos,
  saleRecords,
  saleItems,
  noSalesWeeks,
  tipViews,
];

describe('SNAPSHOT_COLUMNS', () => {
  test.each(TABLES.map((table) => [getTableName(table), table] as const))(
    'covers exactly the columns of %s',
    (name, table) => {
      const columns = Object.values(getTableColumns(table)).map((column) => column.name);
      expect([...SNAPSHOT_COLUMNS[name as SnapshotTable]].sort()).toEqual([...columns].sort());
    },
  );
});
