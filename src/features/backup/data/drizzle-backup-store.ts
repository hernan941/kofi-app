import { asc, count, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { AppDatabase } from '@/core/db/open';
import { runAsPromise } from '@/core/db/run-as-promise';
import {
  noSalesWeeks,
  productPhotos,
  productVersions,
  products,
  saleItems,
  saleRecords,
  tipViews,
} from '@/core/db/schema';
import type { TableName } from '@/core/db/table-names';
import { tipIdSchema } from '@/features/tips/domain';
import type { Logger } from '@/shared/lib/logger';

import type { DatabaseSnapshot, SnapshotTipViewRow } from '../domain/snapshot';
import type { BackupDatabaseAccess, BackupStore } from './backup-store';

const INSERT_BATCH_SIZE = 200;

const DELETE_ORDER = [
  saleItems,
  saleRecords,
  noSalesWeeks,
  productPhotos,
  productVersions,
  products,
  tipViews,
] as const;

const RESTORED_TABLE_NAMES: readonly TableName[] = [
  'products',
  'product_versions',
  'product_photos',
  'sale_records',
  'sale_items',
  'no_sales_weeks',
  'tip_views',
];

function insertInBatches<T extends SQLiteTable>(
  tx: AppDatabase,
  table: T,
  rows: readonly T['$inferInsert'][],
): void {
  for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
    tx.insert(table)
      .values(rows.slice(start, start + INSERT_BATCH_SIZE))
      .run();
  }
}

/** Acceso a la base y logger que recibe {@link createDrizzleBackupStore}. */
export interface DrizzleBackupStoreOptions extends BackupDatabaseAccess {
  readonly logger: Logger;
}

/**
 * Implementación Drizzle de {@link BackupStore}. `replaceAll` es la excepción de la restauración
 * (ADR-006). `readSnapshot` lee las siete tablas dentro de
 * una misma transacción, para que el snapshot sea consistente, y no toca ninguna tabla, así
 * que no emite `DataChanges`. Una fila de `tip_views` con un id inválido se descarta y se
 * registra, en lugar de impedir el respaldo.
 */
export function createDrizzleBackupStore(options: DrizzleBackupStoreOptions): BackupStore {
  function parseTipViews(
    rows: readonly {
      tipId: string;
      firstSeenAt: SnapshotTipViewRow['firstSeenAt'];
      updatedAt: SnapshotTipViewRow['updatedAt'];
    }[],
  ): SnapshotTipViewRow[] {
    return rows.flatMap((row) => {
      const tipId = tipIdSchema.safeParse(row.tipId);
      if (!tipId.success) {
        options.logger.warn('backup_invalid_tip_view');
        return [];
      }
      return [{ tipId: tipId.data, firstSeenAt: row.firstSeenAt, updatedAt: row.updatedAt }];
    });
  }

  return {
    replaceAll: (snapshot) =>
      runAsPromise(() => {
        options.runInTransaction((tx, touched) => {
          for (const table of DELETE_ORDER) {
            tx.delete(table).run();
          }
          insertInBatches(tx, products, snapshot.products);
          insertInBatches(tx, productVersions, snapshot.productVersions);
          insertInBatches(tx, productPhotos, snapshot.productPhotos);
          insertInBatches(tx, saleRecords, snapshot.saleRecords);
          insertInBatches(tx, saleItems, snapshot.saleItems);
          insertInBatches(tx, noSalesWeeks, snapshot.noSalesWeeks);
          insertInBatches(tx, tipViews, snapshot.tipViews);
          for (const name of RESTORED_TABLE_NAMES) {
            touched.add(name);
          }
        });
      }),
    countActive: () =>
      runAsPromise(() =>
        options.runInTransaction((tx) => ({
          products:
            tx.select({ total: count() }).from(products).where(isNull(products.deletedAt)).get()
              ?.total ?? 0,
          saleRecords:
            tx
              .select({ total: count() })
              .from(saleRecords)
              .where(isNull(saleRecords.deletedAt))
              .get()?.total ?? 0,
          activePhotos:
            tx
              .select({ total: count() })
              .from(productPhotos)
              .where(isNull(productPhotos.deletedAt))
              .get()?.total ?? 0,
        })),
      ),
    readSnapshot: () =>
      runAsPromise(() =>
        options.runInTransaction((tx): DatabaseSnapshot => ({
          products: tx.select().from(products).orderBy(asc(products.id)).all(),
          productVersions: tx.select().from(productVersions).orderBy(asc(productVersions.id)).all(),
          productPhotos: tx.select().from(productPhotos).orderBy(asc(productPhotos.id)).all(),
          saleRecords: tx.select().from(saleRecords).orderBy(asc(saleRecords.id)).all(),
          saleItems: tx.select().from(saleItems).orderBy(asc(saleItems.id)).all(),
          noSalesWeeks: tx.select().from(noSalesWeeks).orderBy(asc(noSalesWeeks.id)).all(),
          tipViews: parseTipViews(tx.select().from(tipViews).orderBy(asc(tipViews.tipId)).all()),
        })),
      ),
  };
}
