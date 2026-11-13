import type { AppDatabase } from '@/core/db/open';
import { insertSaleRows } from '@/features/sales/testing/insert-sale-rows';
import { fixtureId, makeSaleItem, makeSaleRecord } from '@/features/sales/testing/sale-fixtures';
import { saleRecordIdSchema, type ProductId, type ProductVersionId } from '@/shared/domain';

const DELETED_AT = makeSaleRecord().createdAt;

/** Qué insertar: una venta de una versión, con o sin borrado lógico. */
export interface SaleSeed {
  readonly productId: ProductId;
  readonly versionId: ProductVersionId;
  readonly itemDeleted?: boolean;
  readonly recordDeleted?: boolean;
}

/**
 * Inserta un registro con un ítem de la versión dada usando las fábricas de ventas, sin pasar
 * por la feature de ventas. `n` distingue los ids de cada venta sembrada.
 */
export function insertSale(db: AppDatabase, seed: SaleSeed, n: number): void {
  const item = makeSaleItem(n, { productId: seed.productId, productVersionId: seed.versionId });
  const record = makeSaleRecord([item], { id: saleRecordIdSchema.parse(fixtureId(4, n)) });
  insertSaleRows(db, record, {
    ...(seed.recordDeleted === true ? { recordDeletedAt: DELETED_AT } : {}),
    ...(seed.itemDeleted === true ? { itemsDeletedAt: DELETED_AT } : {}),
  });
}
