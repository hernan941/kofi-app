import { addDays, isoWeekStart } from './arithmetic';
import type { LocalDate } from './local-date';

/** Rango cerrado de fechas locales de una semana ISO (lunes a domingo). */
export interface WeekRange {
  readonly start: LocalDate;
  readonly end: LocalDate;
}

/** Semana ISO que contiene la fecha. */
export function weekRangeOf(date: LocalDate): WeekRange {
  const start = isoWeekStart(date);
  return { start, end: addDays(start, 6) };
}
