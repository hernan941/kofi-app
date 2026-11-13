import { useDependencies } from '@/core/providers/dependencies-context';
import type { LocalCalendar } from '@/shared/domain/calendar/local-calendar';

/** Calendario del dispositivo que entrega la raíz de composición (`useDependencies().calendar`). */
export function useDeviceCalendar(): LocalCalendar {
  return useDependencies().calendar;
}
