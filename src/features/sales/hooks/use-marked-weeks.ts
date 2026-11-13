import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';
import { addDays, weekRangeOf, type LocalDate } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';

import { noSalesKeys } from './query-keys';

const DAYS_IN_WEEK = 7;

/**
 * Lunes de las semanas marcadas como "no vendí" entre la semana anterior y la actual
 * (`useToday`); `undefined` mientras carga. Comparte la clave con `useNoSalesPrompt`, así que
 * no suma una consulta más.
 */
export function useMarkedWeeks(): ReadonlySet<LocalDate> | undefined {
  const { noSalesWeeks } = useDependencies();
  const current = weekRangeOf(useToday());
  const previous = weekRangeOf(addDays(current.start, -DAYS_IN_WEEK));
  const { data } = useQuery({
    queryKey: noSalesKeys.between(previous.start, current.end),
    queryFn: () => noSalesWeeks.listBetween(previous.start, current.end),
  });
  return useMemo(
    () => (data === undefined ? undefined : new Set(data.map((m) => m.weekStart))),
    [data],
  );
}
