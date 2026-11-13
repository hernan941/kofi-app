import { addDays, type LocalDate } from '@/shared/domain';

import type { NoSalesWeek } from './sale';

/** Tamaño de cada ventana de consulta hacia atrás. */
export const STREAK_SCAN_WEEKS = 26;

const DAYS_IN_WEEK = 7;

/** Racha de semanas seguidas con registro (ADR-007, regla 11). */
export interface Streak {
  /** Semanas seguidas registradas. */
  readonly weeks: number;
  /** `true` si la semana en curso ya está registrada y cuenta. */
  readonly includesCurrentWeek: boolean;
  /** Lunes de la semana más antigua de la racha; `null` con racha 0. */
  readonly oldestWeekStart: LocalDate | null;
}

/** Lunes registrados: semanas con ventas (ya filtradas) unidas con las marcas activas. */
export function registeredWeeks(
  saleWeekStarts: readonly LocalDate[],
  marks: readonly NoSalesWeek[],
): ReadonlySet<LocalDate> {
  return new Set([...saleWeekStarts, ...marks.map((mark) => mark.weekStart)]);
}

/**
 * Cuenta desde la semana en curso si está registrada; si no, desde la anterior. La anterior
 * sin registrar da 0. Retrocede de a 7 días con `addDays`, así que cruza el año sin casos especiales.
 */
export function streakFrom(
  currentWeekStart: LocalDate,
  registered: ReadonlySet<LocalDate>,
): Streak {
  const includesCurrentWeek = registered.has(currentWeekStart);
  let cursor = includesCurrentWeek ? currentWeekStart : addDays(currentWeekStart, -DAYS_IN_WEEK);
  let weeks = 0;
  let oldestWeekStart: LocalDate | null = null;
  while (registered.has(cursor)) {
    weeks += 1;
    oldestWeekStart = cursor;
    cursor = addDays(cursor, -DAYS_IN_WEEK);
  }
  return { weeks, includesCurrentWeek: includesCurrentWeek && weeks > 0, oldestWeekStart };
}
