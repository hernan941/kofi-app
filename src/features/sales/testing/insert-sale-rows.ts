import type { AppDatabase } from '@/core/db/open';
import { saleItems } from '@/core/db/schema/sale-items';
import { saleRecords } from '@/core/db/schema/sale-records';
import type { EpochMs } from '@/shared/domain';

import type { SaleRecord } from '../domain';

/** Borrados lógicos que se quieren simular al insertar filas de prueba. */
export interface SaleRowsDeletion {
  readonly recordDeletedAt?: EpochMs;
  readonly itemsDeletedAt?: EpochMs;
}

/**
 * Inserta un registro y sus ítems directamente en las tablas, sin pasar por el repositorio ni
 * emitir `DataChanges`. Es la única forma de sembrar ventas en los tests con base real.
 */
export function insertSaleRows(
  db: AppDatabase,
  record: SaleRecord,
  deletion: SaleRowsDeletion = {},
): void {
  db.insert(saleRecords)
    .values({
      id: record.id,
      soldOn: record.soldOn,
      channel: record.channel,
      note: record.note,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: deletion.recordDeletedAt ?? null,
    })
    .run();
  for (const item of record.items) {
    db.insert(saleItems)
      .values({
        id: item.id,
        saleRecordId: record.id,
        productId: item.productId,
        productVersionId: item.productVersionId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        position: item.position,
        createdAt: record.updatedAt,
        updatedAt: record.updatedAt,
        deletedAt: deletion.itemsDeletedAt ?? null,
      })
      .run();
  }
}
