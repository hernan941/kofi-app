import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { EpochMs } from '@/shared/domain/epoch-ms';
import type { ProductId, ProductPhotoId } from '@/shared/domain/ids';

import { products } from './products';

/** Foto de un producto; el archivo `photos/<id>.jpg` vive fuera de la base (ADR-008). */
export const productPhotos = sqliteTable(
  'product_photos',
  {
    id: text('id').$type<ProductPhotoId>().primaryKey(),
    productId: text('product_id')
      .$type<ProductId>()
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    createdAt: integer('created_at').$type<EpochMs>().notNull(),
    updatedAt: integer('updated_at').$type<EpochMs>().notNull(),
    deletedAt: integer('deleted_at').$type<EpochMs>(),
  },
  (table) => [
    check('product_photos_position_check', sql`position >= 0`),
    check('product_photos_width_check', sql`width > 0`),
    check('product_photos_height_check', sql`height > 0`),
    check('product_photos_byte_size_check', sql`byte_size > 0`),
    check(
      'product_photos_sha256_check',
      sql`length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'`,
    ),
    index('product_photos_product_id_idx').on(table.productId),
  ],
);
