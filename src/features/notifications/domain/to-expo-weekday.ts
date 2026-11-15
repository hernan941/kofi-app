import type { IsoWeekday } from '@/shared/domain';

/** Día de la semana de Expo para `WEEKLY` (1 = domingo, 2 = lunes) desde el día ISO (1 = lunes). */
export function toExpoWeekday(weekday: IsoWeekday): number {
  return (weekday % 7) + 1;
}
