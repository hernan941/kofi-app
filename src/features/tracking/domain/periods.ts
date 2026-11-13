import {
  addDays,
  addMonths,
  daysInMonth,
  isoWeekStart,
  localDateFromParts,
  localDateParts,
  monthRange,
  yearMonthOf,
  type LocalDate,
  type LocalDateRange,
} from '@/shared/domain';

/** Rangos de Inicio; todos cerrados y calculados con aritmética pura. */
export interface HomeRanges {
  /** Lunes de esta semana hasta hoy. */
  readonly weekToDate: LocalDateRange;
  /** Lunes anterior hasta el mismo día ISO de la semana anterior (D-19). */
  readonly previousWeekSegment: LocalDateRange;
  /** Día 1 hasta hoy. */
  readonly monthToDate: LocalDateRange;
  /** Día 1 del mes anterior hasta el mismo día, o su último día si ese mes es más corto (D-19). */
  readonly previousMonthSegment: LocalDateRange;
  /** Unión de todo lo anterior: día 1 del mes anterior hasta hoy. */
  readonly fetch: LocalDateRange;
}

const DAYS_PER_WEEK = 7;

/** Tramo equivalente del mes anterior para el mismo día del mes. */
function previousMonthSegmentOf(today: LocalDate): LocalDateRange {
  const previousMonthDate = addMonths(yearMonthOf(today), -1);
  const year = Number(previousMonthDate.slice(0, 4));
  const month = Number(previousMonthDate.slice(5, 7));
  const day = Math.min(localDateParts(today).day, daysInMonth(year, month));
  return {
    start: localDateFromParts(year, month, 1),
    end: localDateFromParts(year, month, day),
  };
}

/** Rangos de comparación de Inicio (D-19) para el día `today`. */
export function homeRanges(today: LocalDate): HomeRanges {
  const weekStart = isoWeekStart(today);
  const previousMonthSegment = previousMonthSegmentOf(today);
  return {
    weekToDate: { start: weekStart, end: today },
    previousWeekSegment: {
      start: addDays(weekStart, -DAYS_PER_WEEK),
      end: addDays(today, -DAYS_PER_WEEK),
    },
    monthToDate: { start: monthRange(today).start, end: today },
    previousMonthSegment,
    fetch: { start: previousMonthSegment.start, end: today },
  };
}
