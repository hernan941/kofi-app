import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { EpochMs } from '@/shared/domain/epoch-ms';

/** Preferencias de notificación del dispositivo: fila única con id `device`, no sincronizable. */
export const notificationPreferences = sqliteTable(
  'notification_preferences',
  {
    id: text('id').primaryKey(),
    weeklyEnabled: integer('weekly_enabled').notNull(),
    weeklyWeekday: integer('weekly_weekday').notNull(),
    weeklyMinuteOfDay: integer('weekly_minute_of_day').notNull(),
    monthlyEnabled: integer('monthly_enabled').notNull(),
    updatedAt: integer('updated_at').$type<EpochMs>().notNull(),
  },
  () => [
    check('notification_preferences_id_check', sql`id = 'device'`),
    check('notification_preferences_weekly_enabled_check', sql`weekly_enabled IN (0, 1)`),
    check('notification_preferences_monthly_enabled_check', sql`monthly_enabled IN (0, 1)`),
    check('notification_preferences_weekday_check', sql`weekly_weekday BETWEEN 1 AND 7`),
    check('notification_preferences_minute_check', sql`weekly_minute_of_day BETWEEN 0 AND 1439`),
  ],
);
