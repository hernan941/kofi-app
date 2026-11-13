import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

import type { LocalDate } from '@/shared/domain/calendar/local-date';
import type { EpochMs } from '@/shared/domain/epoch-ms';
import type { NoSalesWeekId } from '@/shared/domain/ids';

/**
 * Marca "esta semana no vendí". El id es el UUIDv5 de `week_start`, así que todos los
 * dispositivos derivan el mismo id para la misma semana (ADR-007).
 */
export const noSalesWeeks = sqliteTable(
  'no_sales_weeks',
  {
    id: text('id').$type<NoSalesWeekId>().primaryKey(),
    weekStart: text('week_start').$type<LocalDate>().notNull(),
    createdAt: integer('created_at').$type<EpochMs>().notNull(),
    updatedAt: integer('updated_at').$type<EpochMs>().notNull(),
    deletedAt: integer('deleted_at').$type<EpochMs>(),
  },
  (table) => [
    unique('no_sales_weeks_week_start_unique').on(table.weekStart),
    check(
      'no_sales_weeks_week_start_check',
      sql`length(week_start) = 10 AND date(week_start) IS NOT NULL AND date(week_start) = week_start AND strftime('%w', week_start) = '1'`,
    ),
  ],
);
