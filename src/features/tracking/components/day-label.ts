import { formatClpAccessible, localDateParts, monthName } from '@/shared/domain';

import type { CalendarDay } from '../domain';

/**
 * Etiqueta accesible de un día de la cuadrícula: "12 de noviembre, 45.000 pesos, 2 ventas",
 * "12 de noviembre, sin ventas" o "12 de noviembre, no disponible" si es futuro. Hoy empieza
 * con "Hoy," y una semana marcada suma ", semana marcada como no vendí". "N ventas" cuenta
 * registros (D-41).
 */
export function dayAccessibilityLabel(day: CalendarDay, weekMarked: boolean): string {
  const { month, day: dayOfMonth } = localDateParts(day.date);
  const date = `${String(dayOfMonth)} de ${monthName(month)}`;
  const prefix = day.isToday ? 'Hoy, ' : '';
  if (day.isFuture) {
    return `${prefix}${date}, no disponible`;
  }
  const { activity } = day;
  const sales =
    activity === null
      ? 'sin ventas'
      : `${formatClpAccessible(activity.total)}, ${String(activity.recordCount)} ${activity.recordCount === 1 ? 'venta' : 'ventas'}`;
  const marked = weekMarked ? ', semana marcada como no vendí' : '';
  return `${prefix}${date}, ${sales}${marked}`;
}
