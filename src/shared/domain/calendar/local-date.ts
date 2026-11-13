import { z } from 'zod';

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS_PER_YEAR = 12;
const FEBRUARY = 2;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Indica si el año es bisiesto en el calendario gregoriano. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Cantidad de días de un mes (1 a 12) de un año. */
export function daysInMonth(year: number, month: number): number {
  if (month === FEBRUARY && isLeapYear(year)) {
    return 29;
  }
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

/** Indica si el texto `YYYY-MM-DD` corresponde a un día que existe en el calendario. */
function isValidCalendarDate(text: string): boolean {
  const match = LOCAL_DATE_PATTERN.exec(text);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= MONTHS_PER_YEAR && day >= 1 && day <= daysInMonth(year, month);
}

/** Fecha local `YYYY-MM-DD` que existe en el calendario; fuente única de `LocalDate` (ADR-015). */
export const localDateSchema = z
  .string()
  .regex(LOCAL_DATE_PATTERN)
  .refine(isValidCalendarDate)
  .brand<'LocalDate'>();

/** Fecha calendario local `YYYY-MM-DD`. */
export type LocalDate = z.infer<typeof localDateSchema>;

/** Día ISO de la semana: 1 = lunes, 7 = domingo. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
