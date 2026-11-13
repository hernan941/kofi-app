import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { EpochMs } from '@/shared/domain/epoch-ms';
import type { ProductId, ProductVersionId } from '@/shared/domain/ids';
import type { Clp } from '@/shared/domain/money';

import { products } from './products';

/** Modalidad de venta de un producto, con precio fijo o a convenir (ADR-007). */
export const productVersions = sqliteTable(
  'product_versions',
  {
    id: text('id').$type<ProductVersionId>().primaryKey(),
    productId: text('product_id')
      .$type<ProductId>()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    name: text('name'),
    pricingMode: text('pricing_mode', { enum: ['fixed', 'negotiable'] }).notNull(),
    price: integer('price').$type<Clp>(),
    cost: integer('cost').$type<Clp>(),
    position: integer('position').notNull(),
    archivedAt: integer('archived_at').$type<EpochMs>(),
    createdAt: integer('created_at').$type<EpochMs>().notNull(),
    updatedAt: integer('updated_at').$type<EpochMs>().notNull(),
    deletedAt: integer('deleted_at').$type<EpochMs>(),
  },
  (table) => [
    check('product_versions_pricing_mode_check', sql`pricing_mode IN ('fixed', 'negotiable')`),
    check(
      'product_versions_pricing_consistency_check',
      sql`(pricing_mode = 'fixed' AND price IS NOT NULL) OR (pricing_mode = 'negotiable' AND price IS NULL)`,
    ),
    check('product_versions_price_check', sql`price BETWEEN 0 AND 999999999`),
    check('product_versions_cost_check', sql`cost BETWEEN 0 AND 999999999`),
    check('product_versions_position_check', sql`position >= 0`),
    index('product_versions_product_id_idx').on(table.productId),
  ],
);
