import { eq } from 'drizzle-orm';

import { runAsPromise } from '@/core/db/run-as-promise';
import { notificationPreferences } from '@/core/db/schema/notification-preferences';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesSchema,
  type NotificationPreferences,
} from '../domain/preferences';
import { assertValidPreferences } from './validate-preferences';
import type { PreferencesDatabaseAccess, PreferencesRepository } from './preferences-repository';

const DEVICE_ID = 'device';

function defaultRowValues() {
  const { weekly, monthly } = DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    weeklyEnabled: weekly.enabled ? 1 : 0,
    weeklyWeekday: weekly.weekday,
    weeklyMinuteOfDay: weekly.minuteOfDay,
    monthlyEnabled: monthly.enabled ? 1 : 0,
  };
}

/**
 * Implementación Drizzle de {@link PreferencesRepository}. Lee y escribe la fila `'device'`;
 * `save` es un solo upsert dentro de `runInTransaction`.
 */
export function createDrizzlePreferencesRepository(
  access: PreferencesDatabaseAccess,
): PreferencesRepository {
  return {
    get: () =>
      runAsPromise((): NotificationPreferences => {
        const row = access
          .db()
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.id, DEVICE_ID))
          .get();
        if (row === undefined) {
          return DEFAULT_NOTIFICATION_PREFERENCES;
        }
        const parsed = notificationPreferencesSchema.safeParse({
          weekly: {
            enabled: row.weeklyEnabled === 1,
            weekday: row.weeklyWeekday,
            minuteOfDay: row.weeklyMinuteOfDay,
          },
          monthly: { enabled: row.monthlyEnabled === 1 },
        });
        if (!parsed.success) {
          access.logger.warn('notification_preferences_invalid_row');
          return DEFAULT_NOTIFICATION_PREFERENCES;
        }
        return parsed.data;
      }),
    save: (preferences, now) =>
      runAsPromise(() => {
        const valid = assertValidPreferences(preferences);
        const values = {
          weeklyEnabled: valid.weekly.enabled ? 1 : 0,
          weeklyWeekday: valid.weekly.weekday,
          weeklyMinuteOfDay: valid.weekly.minuteOfDay,
          monthlyEnabled: valid.monthly.enabled ? 1 : 0,
          updatedAt: now,
        };
        access.runInTransaction((tx, touched) => {
          tx.insert(notificationPreferences)
            .values({ id: DEVICE_ID, ...values })
            .onConflictDoUpdate({ target: notificationPreferences.id, set: values })
            .run();
          touched.add('notification_preferences');
        });
      }),
    getLastWeeklyFireAt: () =>
      runAsPromise(
        () =>
          access
            .db()
            .select({ instant: notificationPreferences.lastWeeklyFireAt })
            .from(notificationPreferences)
            .where(eq(notificationPreferences.id, DEVICE_ID))
            .get()?.instant ?? null,
      ),
    setLastWeeklyFireAt: (instant, now) =>
      runAsPromise(() => {
        access.runInTransaction((tx) => {
          tx.insert(notificationPreferences)
            .values({
              id: DEVICE_ID,
              ...defaultRowValues(),
              updatedAt: now,
              lastWeeklyFireAt: instant,
            })
            .onConflictDoUpdate({
              target: notificationPreferences.id,
              set: { lastWeeklyFireAt: instant },
            })
            .run();
        });
      }),
  };
}
