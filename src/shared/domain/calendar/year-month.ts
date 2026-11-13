import { z } from 'zod';

import { localDateFromParts, monthRange, type LocalDateRange } from './arithmetic';
import type { LocalDate } from './local-date';

const MONTHS_PER_YEAR = 12;

/** Mes calendario `YYYY-MM` (01 a 12); fuente única de `YearMonth`. */
export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .brand<'YearMonth'>();

/** Mes calendario `YYYY-MM`. */
export type YearMonth = z.infer<typeof yearMonthSchema>;

/** Año y mes (1 a 12) de un `YearMonth`. */
function yearMonthParts(month: YearMonth): { readonly year: number; readonly month: number } {
  return { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) };
}

/** Mes que contiene la fecha. */
export function yearMonthOf(date: LocalDate): YearMonth {
  return yearMonthSchema.parse(date.slice(0, 7));
}

/**
 * Suma meses (positivos o negativos) con aritmética pura; cruza años.
 * @throws {Error} Si el resultado queda fuera de los años 0000 a 9999.
 */
export function addMonths(month: YearMonth, months: number): YearMonth {
  const parts = yearMonthParts(month);
  const index = parts.year * MONTHS_PER_YEAR + (parts.month - 1) + months;
  const year = Math.floor(index / MONTHS_PER_YEAR);
  const monthOfYear = index - year * MONTHS_PER_YEAR + 1;
  return yearMonthSchema.parse(
    `${String(year).padStart(4, '0')}-${String(monthOfYear).padStart(2, '0')}`,
  );
}

/** Primer y último día del mes. */
export function monthRangeOf(month: YearMonth): LocalDateRange {
  const parts = yearMonthParts(month);
  return monthRange(localDateFromParts(parts.year, parts.month, 1));
}

/** Negativo, cero o positivo, como `Array.prototype.sort`. */
export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}
