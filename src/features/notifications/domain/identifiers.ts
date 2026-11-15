import type { LocalDate, YearMonth } from '@/shared/domain';

/** Prefijo de las notificaciones que gestiona la reconciliación. */
export const APP_NOTIFICATION_PREFIX = 'cv.';

/** Prefijo de los avisos de prueba, que la reconciliación nunca toca. */
export const TEST_NOTIFICATION_PREFIX = 'cvtest.';

/** Identificador del recordatorio semanal repetitivo (estado A). */
export function weeklyRepeatId(): string {
  return `${APP_NOTIFICATION_PREFIX}weekly.repeat`;
}

/** Identificador del recordatorio semanal de una sola vez de la semana que empieza en `weekStart`. */
export function weeklyOnceId(weekStart: LocalDate): string {
  return `${APP_NOTIFICATION_PREFIX}weekly.${weekStart}`;
}

/** Identificador del resumen mensual que se dispara en `fireMonth`. */
export function monthlyId(fireMonth: YearMonth): string {
  return `${APP_NOTIFICATION_PREFIX}monthly.${fireMonth}`;
}

/** Indica si el identificador pertenece a las notificaciones de la app (`cv.`). */
export function isAppNotificationId(identifier: string): boolean {
  return identifier.startsWith(APP_NOTIFICATION_PREFIX);
}
