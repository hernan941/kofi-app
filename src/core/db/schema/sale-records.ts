import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { LocalDate } from '@/shared/domain/calendar/local-date';
import type { EpochMs } from '@/shared/domain/epoch-ms';
import type { SaleRecordId } from '@/shared/domain/ids';

/** Lo vendido en una misma ocasión; `sold_on` es una fecha local `YYYY-MM-DD` (ADR-015). */
export const saleRecords = sqliteTable(
  'sale_records',
  {
    id: text('id').$type<SaleRecordId>().primaryKey(),
    soldOn: text('sold_on').$type<LocalDate>().notNull(),
    channel: text('channel', {
      enum: ['fair', 'social_media', 'store_or_consignment', 'custom_order', 'other'],
    }),
    note: text('note'),
    createdAt: integer('created_at').$type<EpochMs>().notNull(),
    updatedAt: integer('updated_at').$type<EpochMs>().notNull(),
    deletedAt: integer('deleted_at').$type<EpochMs>(),
  },
  (table) => [
    check(
      'sale_records_sold_on_check',
      sql`length(sold_on) = 10 AND date(sold_on) IS NOT NULL AND date(sold_on) = sold_on`,
    ),
    check(
      'sale_records_channel_check',
      sql`channel IS NULL OR channel IN ('fair', 'social_media', 'store_or_consignment', 'custom_order', 'other')`,
    ),
    index('sale_records_listing_idx')
      .on(table.soldOn, table.createdAt, table.id)
      .where(sql`deleted_at IS NULL`),
  ],
);
