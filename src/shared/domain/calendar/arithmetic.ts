import { daysInMonth, localDateSchema, type IsoWeekday, type LocalDate } from './local-date';

const DAYS_PER_WEEK = 7;
const DAYS_PER_ERA = 146_097;
const YEARS_PER_ERA = 400;
const DAYS_FROM_ERA_START_TO_EPOCH = 719_468;
const THURSDAY = 4;
const ISO_WEEKDAYS: readonly IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Año, mes (1 a 12) y día (1 a 31) de una fecha local. */
export interface LocalDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Primer y último día de un período, ambos incluidos. */
export interface LocalDateRange {
  readonly start: LocalDate;
  readonly end: LocalDate;
}

/** Descompone una fecha local en año, mes y día. */
export function localDateParts(date: LocalDate): LocalDateParts {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

/**
 * Construye una fecha local desde sus partes.
 * @throws {Error} Si las partes no forman un día que exista.
 */
export function localDateFromParts(year: number, month: number, day: number): LocalDate {
  const text = [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
  return localDateSchema.parse(text);
}

/** Número de día civil (días desde 1970-01-01) de una fecha; algoritmo *days from civil*. */
function toDayNumber(date: LocalDate): number {
  const { year, month, day } = localDateParts(date);
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / YEARS_PER_ERA);
  const yearOfEra = shiftedYear - era * YEARS_PER_ERA;
  const shiftedMonth = month > 2 ? month - 3 : month + 9;
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * DAYS_PER_ERA + dayOfEra - DAYS_FROM_ERA_START_TO_EPOCH;
}

/** Fecha local de un número de día civil; algoritmo *civil from days*. */
function fromDayNumber(dayNumber: number): LocalDate {
  const shifted = dayNumber + DAYS_FROM_ERA_START_TO_EPOCH;
  const era = Math.floor(shifted / DAYS_PER_ERA);
  const dayOfEra = shifted - era * DAYS_PER_ERA;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1;
  const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9;
  const year = yearOfEra + era * YEARS_PER_ERA + (month <= 2 ? 1 : 0);
  return localDateFromParts(year, month, day);
}

/**
 * Suma días (positivos o negativos) a una fecha local con aritmética de calendario pura.
 * @throws {Error} Si el resultado queda fuera de los años 0000 a 9999.
 */
export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Días desde `from` hasta `to`; negativo si `to` es anterior. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** Indica si `date` es estrictamente posterior a `reference` (por ejemplo, a "hoy"). */
export function isAfter(date: LocalDate, reference: LocalDate): boolean {
  return date > reference;
}

/** Día ISO de la semana (1 = lunes, 7 = domingo). */
export function isoWeekday(date: LocalDate): IsoWeekday {
  const mondayBased =
    (((toDayNumber(date) + THURSDAY - 1) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return ISO_WEEKDAYS[mondayBased] ?? 1;
}

/** Lunes de la semana ISO que contiene la fecha. */
export function isoWeekStart(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** Primer y último día del mes de la fecha. */
export function monthRange(date: LocalDate): LocalDateRange {
  const { year, month } = localDateParts(date);
  return {
    start: localDateFromParts(year, month, 1),
    end: localDateFromParts(year, month, daysInMonth(year, month)),
  };
}
