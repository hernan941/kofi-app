import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { EpochMs } from '@/shared/domain/epoch-ms';
import type { ProductId, ProductVersionId, SaleItemId, SaleRecordId } from '@/shared/domain/ids';
import type { Clp } from '@/shared/domain/money';

import { productVersions } from './product-versions';
import { products } from './products';
import { saleRecords } from './sale-records';

/** Línea de un registro de venta con el precio y el costo copiados al vender (ADR-007). */
export const saleItems = sqliteTable(
  'sale_items',
  {
    id: text('id').$type<SaleItemId>().primaryKey(),
    saleRecordId: text('sale_record_id')
      .$type<SaleRecordId>()
      .notNull()
      .references(() => saleRecords.id, { onDelete: 'restrict' }),
    productId: text('product_id')
      .$type<ProductId>()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    productVersionId: text('product_version_id')
      .$type<ProductVersionId>()
      .notNull()
      .references(() => productVersions.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').$type<Clp>().notNull(),
    unitCost: integer('unit_cost').$type<Clp>(),
    position: integer('position').notNull(),
    createdAt: integer('created_at').$type<EpochMs>().notNull(),
    updatedAt: integer('updated_at').$type<EpochMs>().notNull(),
    deletedAt: integer('deleted_at').$type<EpochMs>(),
  },
  (table) => [
    check('sale_items_quantity_check', sql`quantity BETWEEN 1 AND 9999`),
    check('sale_items_unit_price_check', sql`unit_price BETWEEN 0 AND 999999999`),
    check('sale_items_unit_cost_check', sql`unit_cost BETWEEN 0 AND 999999999`),
    check('sale_items_position_check', sql`position >= 0`),
    index('sale_items_sale_record_id_idx').on(table.saleRecordId),
    index('sale_items_product_version_id_idx').on(table.productVersionId),
    index('sale_items_product_id_idx').on(table.productId),
  ],
);
