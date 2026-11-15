import { isAppNotificationId } from './identifiers';
import type { NotificationContent, PlannedNotification, PlannedTrigger } from './plan';

/** Notificación `cv.*` que el adaptador no pudo reconstruir desde su payload; siempre se cancela. */
export interface UnrecognizedScheduledNotification {
  readonly identifier: string;
  readonly kind: 'unrecognized';
}

/** Lo programado en el sistema, normalizado por el adaptador desde `content` y `content.data`. */
export type ScheduledNotification = PlannedNotification | UnrecognizedScheduledNotification;

/** Cambios necesarios para que lo programado coincida con el plan (ADR-011). */
export interface NotificationDiff {
  /** Ids a cancelar: los que sobran, los que cambiaron y los no reconocidos. */
  readonly toCancel: readonly string[];
  /** Lo que falta o cambió, en el orden del plan. */
  readonly toSchedule: readonly PlannedNotification[];
}

function sameTrigger(a: PlannedTrigger, b: PlannedTrigger): boolean {
  if (a.type === 'once') {
    return b.type === 'once' && a.fireAt === b.fireAt;
  }
  return b.type === 'weekly' && a.weekday === b.weekday && a.minuteOfDay === b.minuteOfDay;
}

function sameContent(a: NotificationContent, b: NotificationContent): boolean {
  if (a.title !== b.title || a.body !== b.body || a.deepLink !== b.deepLink) {
    return false;
  }
  const monthA = a.deepLink === '/tracking/monthly' ? a.month : undefined;
  const monthB = b.deepLink === '/tracking/monthly' ? b.month : undefined;
  return monthA === monthB;
}

/** Igualdad estructural de `kind`, `trigger` y `content` (incluido `month`), campo a campo. */
export function samePlannedNotification(a: PlannedNotification, b: PlannedNotification): boolean {
  return (
    a.kind === b.kind && sameTrigger(a.trigger, b.trigger) && sameContent(a.content, b.content)
  );
}

/** Compara por identificador. Ignora los ids sin el prefijo `cv.` (también los `cvtest.`). */
export function diffNotifications(
  plan: readonly PlannedNotification[],
  scheduled: readonly ScheduledNotification[],
): NotificationDiff {
  const current = scheduled.filter((item) => isAppNotificationId(item.identifier));
  const planned = new Map(plan.map((item) => [item.identifier, item]));
  const existing = new Map(current.map((item) => [item.identifier, item]));

  const toCancel = current
    .filter((item) => {
      const wanted = planned.get(item.identifier);
      return (
        wanted === undefined ||
        item.kind === 'unrecognized' ||
        !samePlannedNotification(wanted, item)
      );
    })
    .map((item) => item.identifier);
  const cancelled = new Set(toCancel);
  const toSchedule = plan.filter(
    (item) => !existing.has(item.identifier) || cancelled.has(item.identifier),
  );
  return { toCancel, toSchedule };
}
