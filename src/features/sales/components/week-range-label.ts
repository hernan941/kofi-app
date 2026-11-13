import { localDateParts, monthName, type WeekRange } from '@/shared/domain';

/** "30 de noviembre", con el año si `withYear`. */
function dayAndMonth(date: WeekRange['start'], withYear: boolean): string {
  const { year, month, day } = localDateParts(date);
  const base = `${String(day)} de ${monthName(month)}`;
  return withYear ? `${base} de ${String(year)}` : base;
}

/**
 * Rango de una semana para las preguntas de "no vendí": "del 2 al 8 de noviembre"; si cruza
 * el mes, "del 30 de noviembre al 6 de diciembre"; si cruza el año, con los dos años.
 */
export function describeWeekRange(week: WeekRange): string {
  const start = localDateParts(week.start);
  const end = localDateParts(week.end);
  if (start.year !== end.year) {
    return `del ${dayAndMonth(week.start, true)} al ${dayAndMonth(week.end, true)}`;
  }
  if (start.month !== end.month) {
    return `del ${dayAndMonth(week.start, false)} al ${dayAndMonth(week.end, false)}`;
  }
  return `del ${String(start.day)} al ${dayAndMonth(week.end, false)}`;
}

/** Inicio de una semana en curso: "desde el lunes 9". */
export function describeWeekStart(week: WeekRange): string {
  return `desde el lunes ${String(localDateParts(week.start).day)}`;
}
