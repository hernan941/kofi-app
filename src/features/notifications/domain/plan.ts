import {
  addDays,
  addMonths,
  isoWeekStart,
  localDateSchema,
  weekRangeOf,
  yearMonthOf,
  type EpochMs,
  type IsoWeekday,
  type LocalCalendar,
  type LocalDate,
  type YearMonth,
} from '@/shared/domain';

import { monthlyId, weeklyOnceId, weeklyRepeatId } from './identifiers';
import type { NotificationPreferences } from './preferences';
import { monthlySummaryContent, summarizedMonthOf, weeklyReminderContent } from './texts';

/** Avisos semanales de respaldo de una sola vez en el estado B. */
export const FALLBACK_WEEKS = 47;
/** Resúmenes mensuales que se mantienen programados. */
export const MONTHS_AHEAD = 12;
/** Tope de notificaciones pendientes en iOS (ADR-011). */
export const MAX_PENDING_NOTIFICATIONS = 64;
/** Hora del resumen mensual: 10:00. */
export const MONTHLY_MINUTE_OF_DAY = 600;

/** Tipo de notificación programada por la app. */
export type NotificationKind = 'weekly_reminder' | 'monthly_summary';

/** Variante del texto del recordatorio semanal. */
export type WeeklyReminderVariant = 'already_registered' | 'neutral';

/** Ruta interna a la que lleva tocar la notificación. */
export type NotificationDeepLink = '/sales/new' | '/tracking/monthly';

/** Contenido visible y destino. El resumen mensual lleva el mes que resume (`YYYY-MM`). */
export type NotificationContent =
  | { readonly title: string; readonly body: string; readonly deepLink: '/sales/new' }
  | {
      readonly title: string;
      readonly body: string;
      readonly deepLink: '/tracking/monthly';
      readonly month: YearMonth;
    };

/** Trigger planificado: de una sola vez o semanal repetitivo (hora local de pared). */
export type PlannedTrigger =
  | { readonly type: 'once'; readonly fireAt: EpochMs }
  | { readonly type: 'weekly'; readonly weekday: IsoWeekday; readonly minuteOfDay: number };

/** Notificación a programar. Solo el recordatorio semanal puede ser `weekly`. */
export type PlannedNotification =
  | {
      readonly identifier: string;
      readonly kind: NotificationKind;
      readonly trigger: Extract<PlannedTrigger, { type: 'once' }>;
      readonly content: NotificationContent;
    }
  | {
      readonly identifier: string;
      readonly kind: 'weekly_reminder';
      readonly trigger: Extract<PlannedTrigger, { type: 'weekly' }>;
      readonly content: NotificationContent;
    };

/** Datos para planificar, sin dependencias de plataforma (ADR-011). */
export interface NotificationPlanInput {
  readonly now: EpochMs;
  readonly calendar: LocalCalendar;
  readonly preferences: NotificationPreferences;
  readonly currentWeekRegistered: boolean;
  /** Instante del último recordatorio semanal planificado, o `null` si no hay (D-13). */
  readonly lastWeeklyFireAt: EpochMs | null;
  readonly fallbackWeeks: number;
  readonly monthsAhead: number;
}

/** Instante `T` del recordatorio de la semana ISO que contiene `today`. */
export function weeklyReminderInstant(
  today: LocalDate,
  weekly: NotificationPreferences['weekly'],
  calendar: LocalCalendar,
): EpochMs {
  const monday = weekRangeOf(today).start;
  return calendar.instantAt(addDays(monday, weekly.weekday - 1), weekly.minuteOfDay);
}

/** `true` si el recordatorio de esta semana ya llegó (D-13): el instante guardado ya pasó y cae en ella. */
function weeklyArrivedThisWeek(input: NotificationPlanInput, today: LocalDate): boolean {
  const { lastWeeklyFireAt, now, calendar } = input;
  return (
    lastWeeklyFireAt !== null &&
    lastWeeklyFireAt <= now &&
    isoWeekStart(calendar.localDateOf(lastWeeklyFireAt)) === isoWeekStart(today)
  );
}

/**
 * Instante del recordatorio de la semana en curso que la reconciliación debe recordar para
 * cumplir D-13: el de esta semana si el semanal está activo, todavía no pasó y no llegó otro.
 * `null` si no hay nada nuevo que recordar.
 */
export function weeklyInstantToRemember(input: NotificationPlanInput): EpochMs | null {
  if (!input.preferences.weekly.enabled) {
    return null;
  }
  const today = input.calendar.localDateOf(input.now);
  if (weeklyArrivedThisWeek(input, today)) {
    return null;
  }
  const reminderAt = weeklyReminderInstant(today, input.preferences.weekly, input.calendar);
  return reminderAt > input.now ? reminderAt : null;
}

function planFallbacks(input: NotificationPlanInput, monday: LocalDate): PlannedNotification[] {
  const { weekday, minuteOfDay } = input.preferences.weekly;
  return Array.from({ length: input.fallbackWeeks }, (_, index) => {
    const start = addDays(monday, 7 * (index + 1));
    return {
      identifier: weeklyOnceId(start),
      kind: 'weekly_reminder' as const,
      trigger: {
        type: 'once' as const,
        fireAt: input.calendar.instantAt(addDays(start, weekday - 1), minuteOfDay),
      },
      content: weeklyReminderContent('neutral'),
    };
  });
}

function planWeekly(input: NotificationPlanInput, today: LocalDate): PlannedNotification[] {
  const { calendar, preferences, now } = input;
  const { weekday, minuteOfDay } = preferences.weekly;
  const monday = isoWeekStart(today);
  const reminderAt = weeklyReminderInstant(today, preferences.weekly, calendar);

  if (reminderAt > now && weeklyArrivedThisWeek(input, today)) {
    return planFallbacks(input, monday);
  }
  if (!input.currentWeekRegistered || reminderAt <= now) {
    return [
      {
        identifier: weeklyRepeatId(),
        kind: 'weekly_reminder',
        trigger: { type: 'weekly', weekday, minuteOfDay },
        content: weeklyReminderContent('neutral'),
      },
    ];
  }

  return [
    {
      identifier: weeklyOnceId(monday),
      kind: 'weekly_reminder',
      trigger: { type: 'once', fireAt: reminderAt },
      content: weeklyReminderContent('already_registered'),
    },
    ...planFallbacks(input, monday),
  ];
}

function planMonthly(input: NotificationPlanInput, today: LocalDate): PlannedNotification[] {
  const planned: PlannedNotification[] = [];
  let fireMonth = yearMonthOf(today);
  while (planned.length < input.monthsAhead) {
    const fireAt = input.calendar.instantAt(
      localDateSchema.parse(`${fireMonth}-01`),
      MONTHLY_MINUTE_OF_DAY,
    );
    if (fireAt > input.now) {
      planned.push({
        identifier: monthlyId(fireMonth),
        kind: 'monthly_summary',
        trigger: { type: 'once', fireAt },
        content: monthlySummaryContent(summarizedMonthOf(fireMonth)),
      });
    }
    fireMonth = addMonths(fireMonth, 1);
  }
  return planned;
}

function fireTime(item: PlannedNotification): number {
  return item.trigger.type === 'once' ? item.trigger.fireAt : -1;
}

/**
 * Plan completo, ordenado: primero `cv.weekly.repeat` si existe y después los avisos de una
 * sola vez por `fireAt` ascendente (empates por `identifier`). Sin instantes `<= now`, sin dos
 * avisos semanales para la misma semana y con a lo sumo 64 pendientes (60 en el estado B).
 */
export function planNotifications(input: NotificationPlanInput): readonly PlannedNotification[] {
  const today = input.calendar.localDateOf(input.now);
  const weekly = input.preferences.weekly.enabled ? planWeekly(input, today) : [];
  const monthly = input.preferences.monthly.enabled ? planMonthly(input, today) : [];
  return [...weekly, ...monthly].sort(
    (a, b) =>
      fireTime(a) - fireTime(b) ||
      (a.identifier < b.identifier ? -1 : a.identifier > b.identifier ? 1 : 0),
  );
}
