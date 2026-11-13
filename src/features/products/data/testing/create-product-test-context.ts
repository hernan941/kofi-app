import type { TableName } from '@/core/db/table-names';
import { createTestDatabase, type TestDatabase } from '@/core/db/testing/test-database';

import { createDrizzleProductRepository } from '../drizzle-product-repository';
import type { ProductRepository, ProductWriter } from '../product-repository';

/** Base real en memoria con el repositorio Drizzle conectado y un registro de lo emitido. */
export interface ProductTestContext {
  readonly database: TestDatabase;
  readonly repository: ProductRepository & ProductWriter;
  /** Un elemento por cada `DataChanges` emitido desde que se creó el contexto. */
  readonly emitted: ReadonlySet<TableName>[];
}

/** Crea el contexto de los tests con base real de productos. */
export async function createProductTestContext(): Promise<ProductTestContext> {
  const database = await createTestDatabase();
  const emitted: ReadonlySet<TableName>[] = [];
  database.dataChanges.subscribe((tables) => {
    emitted.push(tables);
  });
  const repository = createDrizzleProductRepository({
    db: () => database.db,
    runInTransaction: database.runInTransaction,
  });
  return { database, repository, emitted };
}
