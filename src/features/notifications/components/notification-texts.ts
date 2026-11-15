import { weekdayName, type IsoWeekday } from '@/shared/domain';

import type { ReminderSummary } from '../domain/reminder-summary';

const MINUTES_PER_HOUR = 60;

/** Options of {@link weekdayPlural}. */
export interface WeekdayPluralOptions {
  /** Starts with a capital and drops the article: "Sábados" instead of "los sábados". */
  readonly capitalized?: boolean;
}

/**
 * Weekday in plural for reminder texts: "los domingos", or "Domingos" when it starts a line.
 * The plural adds an "s" only when the name does not end in one ("lunes").
 */
export function weekdayPlural(
  weekday: IsoWeekday,
  { capitalized = false }: WeekdayPluralOptions = {},
): string {
  const name = weekdayName(weekday);
  const plural = name.endsWith('s') ? name : `${name}s`;
  if (!capitalized) {
    return `los ${plural}`;
  }
  return `${plural.charAt(0).toUpperCase()}${plural.slice(1)}`;
}

/** Time of day as "H:MM" in 24 hours with no leading zero on the hour: 510 -> "8:30". */
export function formatReminderTime(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
  const minutes = minuteOfDay % MINUTES_PER_HOUR;
  return `${String(hours)}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Subtítulo de la fila "Recordatorios" de Ajustes (settings.md, 5.2); `null` mientras carga,
 * para que la fila se muestre sin subtítulo.
 */
export function reminderSummaryText(summary: ReminderSummary): string | null {
  switch (summary.kind) {
    case 'loading':
      return null;
    case 'permission_off':
      return 'Los avisos están apagados en tu teléfono';
    case 'permission_pending':
      return 'Los avisos están sin activar';
    case 'all_off':
      return 'Apagados';
    case 'on': {
      if (summary.weekly === null) {
        return 'Solo el resumen del mes';
      }
      const weekly = `${weekdayPlural(summary.weekly.weekday, { capitalized: true })} a las ${formatReminderTime(summary.weekly.minuteOfDay)}`;
      return summary.monthly ? `${weekly} y resumen del mes` : weekly;
    }
  }
}
