import type { IsoWeekday } from './local-date';

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const WEEKDAY_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const;

/**
 * Nombre del mes en español, en minúsculas (1 = enero).
 * @throws {RangeError} Si el mes no está entre 1 y 12.
 */
export function monthName(month: number): (typeof MONTH_NAMES)[number] {
  const name = MONTH_NAMES[month - 1];
  if (name === undefined) {
    throw new RangeError(`Month out of range: ${String(month)}`);
  }
  return name;
}

/** Nombre del día de la semana en español, en minúsculas (1 = lunes). */
export function weekdayName(weekday: IsoWeekday): (typeof WEEKDAY_NAMES)[number] {
  return WEEKDAY_NAMES[weekday - 1] ?? 'lunes';
}
