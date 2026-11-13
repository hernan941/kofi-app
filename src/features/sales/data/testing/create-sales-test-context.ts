import type { TableName } from '@/core/db/table-names';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';
import type { Product } from '@/features/products/domain';
import type { ProductWriter } from '@/features/products';
import type { ProductId } from '@/shared/domain';

import { createDrizzleNoSalesWeekRepository } from '../drizzle-no-sales-week-repository';
import { createDrizzleSaleRepository } from '../drizzle-sale-repository';
import type {
  NoSalesWeekRepository,
  NoSalesWeekWriter,
  SaleRecordWriter,
  SaleRepository,
} from '../sale-repository';
import { insertCatalogRows } from './insert-catalog-rows';

/** Base real en memoria con los repositorios de ventas Drizzle conectados y un registro de lo emitido. */
export interface SalesTestContext {
  readonly database: TestDatabase;
  /** Lectura de productos que usan los casos de uso; sirve lo sembrado con `addProduct`. */
  readonly products: Pick<ProductWriter, 'findByIdSync'>;
  readonly sales: SaleRepository & SaleRecordWriter;
  readonly noSalesWeeks: NoSalesWeekRepository & NoSalesWeekWriter;
  /** Un elemento por cada `DataChanges` emitido desde que se creó el contexto. */
  readonly emitted: ReadonlySet<TableName>[];
  /** Siembra el producto en la base (para las llaves foráneas) y en `products`, sin emitir. */
  addProduct(product: Product): void;
}

/** Crea el contexto de los tests de ventas con base real. */
export async function createSalesTestContext(): Promise<SalesTestContext> {
  const database = await createTestDatabase();
  const emitted: ReadonlySet<TableName>[] = [];
  database.dataChanges.subscribe((tables) => {
    emitted.push(tables);
  });
  const access = { db: () => database.db, runInTransaction: database.runInTransaction };
  const catalog = new Map<ProductId, Product>();
  return {
    database,
    products: { findByIdSync: (id) => catalog.get(id) ?? null },
    sales: createDrizzleSaleRepository(access),
    noSalesWeeks: createDrizzleNoSalesWeekRepository(access),
    emitted,
    addProduct: (product) => {
      insertCatalogRows(database.db, product);
      catalog.set(product.id, product);
    },
  };
}
