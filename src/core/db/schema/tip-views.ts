import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { EpochMs } from '@/shared/domain/epoch-ms';

/** Consejos ya vistos; la PK es el slug estable del catálogo, no un UUID (ADR-007). */
export const tipViews = sqliteTable('tip_views', {
  tipId: text('tip_id').primaryKey(),
  firstSeenAt: integer('first_seen_at').$type<EpochMs>().notNull(),
  updatedAt: integer('updated_at').$type<EpochMs>().notNull(),
});
