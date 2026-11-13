import { epochMsSchema, type EpochMs } from '../epoch-ms';

import { addDays, localDateFromParts, localDateParts } from './arithmetic';
import type { LocalCalendar } from './local-calendar';
import type { LocalDate } from './local-date';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const MINUTES_PER_DAY = 1440;
const MINUTES_PER_HOUR = 60;

/** Desfase de la zona del proceso en minutos (UTC menos hora local) en un instante. */
function offsetAt(instantMs: number): number {
  return new Date(instantMs).getTimezoneOffset();
}

/**
 * Primer instante, a precisión de minuto, en el que el desfase deja de ser `offsetBefore`,
 * dentro del intervalo `(low, high]`; es decir, el fin de un salto hacia adelante.
 */
function firstInstantAfterGap(low: number, high: number, offsetBefore: number): number {
  let lowMinutes = Math.floor(low / MS_PER_MINUTE);
  let highMinutes = Math.floor(high / MS_PER_MINUTE);
  while (highMinutes - lowMinutes > 1) {
    const middle = Math.floor((lowMinutes + highMinutes) / 2);
    if (offsetAt(middle * MS_PER_MINUTE) === offsetBefore) {
      lowMinutes = middle;
    } else {
      highMinutes = middle;
    }
  }
  return highMinutes * MS_PER_MINUTE;
}

/**
 * Resuelve una hora de pared a un instante sin depender de cómo el motor trata los minutos
 * inexistentes o repetidos: prueba los dos desfases vecinos y elige el primer instante válido.
 */
function resolveWallTime(wallMs: number): number {
  const offsetBefore = offsetAt(wallMs - 2 * MS_PER_DAY);
  const offsetAfter = offsetAt(wallMs + 2 * MS_PER_DAY);
  const candidates = [offsetBefore, offsetAfter]
    .map((offset) => ({ offset, instant: wallMs + offset * MS_PER_MINUTE }))
    .filter(({ offset, instant }) => offsetAt(instant) === offset)
    .map(({ instant }) => instant);
  if (candidates.length > 0) {
    return Math.min(...candidates);
  }
  return firstInstantAfterGap(
    wallMs + offsetAfter * MS_PER_MINUTE,
    wallMs + offsetBefore * MS_PER_MINUTE,
    offsetBefore,
  );
}

/** Fecha local del dispositivo en la que cae el instante. */
function localDateOf(instant: EpochMs): LocalDate {
  const date = new Date(instant);
  return localDateFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Instante de una hora local de pared; minuto inexistente: primer minuto válido posterior;
 * minuto repetido: primera ocurrencia.
 * @throws {RangeError} Si `minuteOfDay` no es un entero entre 0 y 1439.
 */
function instantAt(date: LocalDate, minuteOfDay: number): EpochMs {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= MINUTES_PER_DAY) {
    throw new RangeError(`Minute of day out of range: ${String(minuteOfDay)}`);
  }
  const { year, month, day } = localDateParts(date);
  const hours = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
  const minutes = minuteOfDay % MINUTES_PER_HOUR;
  const wallMs = Date.UTC(year, month - 1, day, hours, minutes);
  return epochMsSchema.parse(resolveWallTime(wallMs));
}

/** Instante de la próxima medianoche local posterior al instante dado. */
function nextLocalMidnight(instant: EpochMs): EpochMs {
  return instantAt(addDays(localDateOf(instant), 1), 0);
}

/**
 * `LocalCalendar` real sobre `Date` local: usa la zona del dispositivo (o la `TZ` del proceso
 * en Node). Es la única frontera de conversión entre instantes y fechas locales (ADR-015).
 */
export const deviceLocalCalendar: LocalCalendar = { localDateOf, instantAt, nextLocalMidnight };
