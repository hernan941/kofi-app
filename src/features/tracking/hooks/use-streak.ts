import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import { loadStreak } from '@/features/sales';
import type { Streak } from '@/features/sales/domain';
import { useCurrentWeek } from '@/shared/lib/time/use-current-week';

import { trackingKeys } from './query-keys';

/**
 * Racha de semanas seguidas con registro. Cambia de clave el lunes y se recarga al guardar o
 * borrar una venta y al marcar o desmarcar "no vendí".
 */
export function useStreak(): UseQueryResult<Streak> {
  const { sales, noSalesWeeks } = useDependencies();
  const week = useCurrentWeek();
  return useQuery({
    queryKey: trackingKeys.streak(week.start),
    queryFn: () => loadStreak({ sales, noSalesWeeks }, week.start),
  });
}
