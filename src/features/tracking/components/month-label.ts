import { localDateParts, monthName, type LocalDate, type YearMonth } from '@/shared/domain';

/**
 * Nombre del mes en minúscula para usar dentro de una frase ("noviembre"); con el año si no
 * es el de `today` ("noviembre de 2025"). Sin `Intl` (ADR-010).
 */
export function formatMonthLabel(month: YearMonth, today: LocalDate): string {
  const year = Number(month.slice(0, 4));
  const name = monthName(Number(month.slice(5, 7)));
  return localDateParts(today).year === year ? name : `${name} de ${String(year)}`;
}

/** Igual que {@link formatMonthLabel}, con mayúscula inicial para empezar una frase ("Noviembre"). */
export function formatMonthTitle(month: YearMonth, today: LocalDate): string {
  const label = formatMonthLabel(month, today);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
