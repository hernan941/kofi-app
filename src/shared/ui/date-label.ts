import {
  addDays,
  isoWeekday,
  localDateParts,
  monthName,
  weekdayName,
  type LocalDate,
} from '@/shared/domain';

/** Uppercases the first letter of a sentence. */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Spanish label of a local date, without `Intl` (ADR-010): "Hoy, viernes 13 de noviembre",
 * "Ayer, …" or "Lunes 2 de marzo". The year is added when it is not the year of `today`,
 * or always when there is no `today` to compare with.
 */
export function formatDateLabel(date: LocalDate, today?: LocalDate): string {
  const { year, month, day } = localDateParts(date);
  const sameYear = today !== undefined && localDateParts(today).year === year;
  const base = `${weekdayName(isoWeekday(date))} ${String(day)} de ${monthName(month)}`;
  const withYear = sameYear ? base : `${base} de ${String(year)}`;
  if (today !== undefined && date === today) {
    return `Hoy, ${withYear}`;
  }
  if (today !== undefined && date === addDays(today, -1)) {
    return `Ayer, ${withYear}`;
  }
  return capitalize(withYear);
}

/**
 * Short Spanish label of a local date for list rows, without `Intl` (ADR-015): "Hoy", "Ayer",
 * "9 de noviembre" or "28 de diciembre de 2025" when the year is not the one of `today`.
 */
export function formatShortDateLabel(date: LocalDate, today: LocalDate): string {
  if (date === today) {
    return 'Hoy';
  }
  if (date === addDays(today, -1)) {
    return 'Ayer';
  }
  const { year, month, day } = localDateParts(date);
  const base = `${String(day)} de ${monthName(month)}`;
  return localDateParts(today).year === year ? base : `${base} de ${String(year)}`;
}
