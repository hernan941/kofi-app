import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { EpochMs } from '@/shared/domain/epoch-ms';
import type { ProductId } from '@/shared/domain/ids';

/** Producto del emprendimiento; se archiva, nunca se borra físicamente (ADR-007). */
export const products = sqliteTable('products', {
  id: text('id').$type<ProductId>().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  archivedAt: integer('archived_at').$type<EpochMs>(),
  createdAt: integer('created_at').$type<EpochMs>().notNull(),
  updatedAt: integer('updated_at').$type<EpochMs>().notNull(),
  deletedAt: integer('deleted_at').$type<EpochMs>(),
});
