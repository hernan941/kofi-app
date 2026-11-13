import { weekRangeOf, type WeekRange } from '@/shared/domain/calendar/week-range';

import { useToday } from './use-today';

/** Semana ISO en curso (lunes a domingo), derivada de {@link useToday}. */
export function useCurrentWeek(): WeekRange {
  return weekRangeOf(useToday());
}
