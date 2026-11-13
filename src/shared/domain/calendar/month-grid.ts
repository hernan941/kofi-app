import { isoWeekday, localDateFromParts, localDateParts } from './arithmetic';
import { daysInMonth, type LocalDate } from './local-date';
import { monthRangeOf, type YearMonth } from './year-month';

const DAYS_PER_WEEK = 7;

/** Una semana de la grilla: siete celdas de lunes a domingo; `null` es un día de otro mes. */
export type MonthGridRow = readonly (LocalDate | null)[];

/**
 * Grilla de un mes para un calendario: filas de lunes a domingo (D-01), con `null` antes del
 * día 1 y después del último día. Aritmética pura de fechas locales (ADR-015), sin `Date`.
 */
export function monthGrid(month: YearMonth): readonly MonthGridRow[] {
  const { start } = monthRangeOf(month);
  const { year, month: monthNumber } = localDateParts(start);
  const lastDay = daysInMonth(year, monthNumber);
  const leadingBlanks = isoWeekday(start) - 1;
  const cells: (LocalDate | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(localDateFromParts(year, monthNumber, day));
  }
  while (cells.length % DAYS_PER_WEEK !== 0) {
    cells.push(null);
  }
  const rows: MonthGridRow[] = [];
  for (let index = 0; index < cells.length; index += DAYS_PER_WEEK) {
    rows.push(cells.slice(index, index + DAYS_PER_WEEK));
  }
  return rows;
}
