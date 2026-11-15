import { localDateParts, monthName, addDays, type EpochMs } from '@/shared/domain';
import type { LocalCalendar } from '@/shared/domain/calendar/local-calendar';

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_HOUR = 60;

/** Fecha y hora de un respaldo para mostrar; `isRelative` es "hoy" o "ayer" (cambia el artículo). */
export interface BackupDate {
  readonly text: string;
  readonly isRelative: boolean;
}

/**
 * Minuto de pared del instante dentro de su día local, con la única conversión que permite
 * ADR-015 (`instantAt`): el mayor minuto cuyo instante no pasa del pedido.
 */
function localMinuteOfDay(instant: EpochMs, calendar: LocalCalendar): number {
  const date = calendar.localDateOf(instant);
  let low = 0;
  let high = MINUTES_PER_DAY - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (calendar.instantAt(date, middle) <= instant) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

function formatTime(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
  const minute = minuteOfDay % MINUTES_PER_HOUR;
  return `${String(hour)}:${String(minute).padStart(2, '0')}`;
}

/**
 * Fecha local de un respaldo (F8.1, 5.6): "hoy, 15:42", "ayer, 9:05" o "13 de noviembre de
 * 2026, 15:42", con la hora en 24 horas sin cero inicial. "Hoy" y "ayer" salen de `now` con
 * `LocalCalendar`.
 */
export function formatBackupDate(
  createdAt: EpochMs,
  now: EpochMs,
  calendar: LocalCalendar,
): BackupDate {
  const date = calendar.localDateOf(createdAt);
  const today = calendar.localDateOf(now);
  const time = formatTime(localMinuteOfDay(createdAt, calendar));
  if (date === today) {
    return { text: `hoy, ${time}`, isRelative: true };
  }
  if (date === addDays(today, -1)) {
    return { text: `ayer, ${time}`, isRelative: true };
  }
  const { year, month, day } = localDateParts(date);
  return {
    text: `${String(day)} de ${monthName(month)} de ${String(year)}, ${time}`,
    isRelative: false,
  };
}

/** La fecha con su artículo para frases como "respaldo de hoy, 15:42" o "respaldo del 13 de …". */
export function backupDateOf(date: BackupDate): string {
  return date.isRelative ? `de ${date.text}` : `del ${date.text}`;
}
