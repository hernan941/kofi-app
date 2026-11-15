import { z } from 'zod';

import { epochMsSchema, yearMonthSchema, type IsoWeekday, type YearMonth } from '@/shared/domain';

import type { PlannedNotification, PlannedTrigger } from './plan';

const triggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('once'), fireAt: epochMsSchema }),
  z.object({
    type: z.literal('weekly'),
    weekday: z
      .number()
      .int()
      .min(1)
      .max(7)
      .transform((value) => value as IsoWeekday),
    minuteOfDay: z.number().int().min(0).max(1439),
  }),
]);

const salesDataSchema = z.object({
  v: z.literal(1),
  kind: z.enum(['weekly_reminder', 'monthly_summary']),
  deepLink: z.literal('/sales/new'),
  trigger: triggerSchema,
});

const monthlyDataSchema = z.object({
  v: z.literal(1),
  kind: z.literal('monthly_summary'),
  deepLink: z.literal('/tracking/monthly'),
  month: yearMonthSchema,
  trigger: triggerSchema,
});

/**
 * Lo que el adaptador guarda en `content.data`. Versionado con `v`. Permite reconstruir la
 * notificación al listar (`trigger`, `kind`) y navegar al tocar (`deepLink`, `month`).
 */
export const notificationDataSchema = z.union([salesDataSchema, monthlyDataSchema]);

/** Forma serializada de una notificación planificada. */
export type NotificationData =
  | {
      readonly v: 1;
      readonly kind: PlannedNotification['kind'];
      readonly deepLink: '/sales/new';
      readonly trigger: PlannedTrigger;
    }
  | {
      readonly v: 1;
      readonly kind: 'monthly_summary';
      readonly deepLink: '/tracking/monthly';
      readonly month: YearMonth;
      readonly trigger: PlannedTrigger;
    };

/** Destino de navegación al tocar. */
export type NotificationTarget =
  | { readonly deepLink: '/sales/new' }
  | { readonly deepLink: '/tracking/monthly'; readonly month: YearMonth };

const targetSchema = z.union([
  z.object({ v: z.literal(1), deepLink: z.literal('/sales/new') }),
  z.object({ v: z.literal(1), deepLink: z.literal('/tracking/monthly'), month: yearMonthSchema }),
]);

/** Serializa el payload de una notificación planificada. */
export function toNotificationData(planned: PlannedNotification): NotificationData {
  const { content, kind, trigger } = planned;
  if (content.deepLink === '/tracking/monthly') {
    return {
      v: 1,
      kind: 'monthly_summary',
      deepLink: content.deepLink,
      month: content.month,
      trigger,
    };
  }
  return { v: 1, kind, deepLink: content.deepLink, trigger };
}

/**
 * Valida `data` con Zod (ADR-010). Al tocar solo importa el destino, así que acepta un
 * `trigger` ausente o desconocido. Devuelve `null` si el destino no es válido; la ruta abre Inicio.
 */
export function parseNotificationTarget(data: unknown): NotificationTarget | null {
  const parsed = targetSchema.safeParse(data);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.deepLink === '/sales/new'
    ? { deepLink: '/sales/new' }
    : { deepLink: '/tracking/monthly', month: parsed.data.month };
}
