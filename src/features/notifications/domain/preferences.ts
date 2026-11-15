import { z } from 'zod';

import type { IsoWeekday } from '@/shared/domain';

/** Minutos que tiene un día; el límite superior (excluido) de `minuteOfDay`. */
export const MINUTES_PER_DAY = 1440;

/** Preferencias de notificación del dispositivo (ADR-007); no viajan en el respaldo (D-28). */
export interface NotificationPreferences {
  readonly weekly: {
    readonly enabled: boolean;
    readonly weekday: IsoWeekday;
    readonly minuteOfDay: number;
  };
  readonly monthly: { readonly enabled: boolean };
}

/** Domingo a las 20:00 y resumen mensual activado (ADR-007, regla 14). */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  weekly: { enabled: true, weekday: 7, minuteOfDay: 1200 },
  monthly: { enabled: true },
};

/** Valida día ISO 1-7 y minuto 0-1439 enteros; es la única fuente de esas reglas. */
export const notificationPreferencesSchema = z.object({
  weekly: z.object({
    enabled: z.boolean(),
    weekday: z
      .number()
      .int()
      .min(1)
      .max(7)
      .transform((value) => value as IsoWeekday),
    minuteOfDay: z
      .number()
      .int()
      .min(0)
      .max(MINUTES_PER_DAY - 1),
  }),
  monthly: z.object({ enabled: z.boolean() }),
}) satisfies z.ZodType<NotificationPreferences>;
