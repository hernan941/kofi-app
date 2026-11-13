import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import { yearMonthOf, type YearMonth } from '@/shared/domain';

import { trackingKeys } from './query-keys';

/** Mes de la venta más antigua, o `null` sin ventas: el límite hacia atrás del resumen (D-30). */
export function useEarliestSaleMonth(): UseQueryResult<YearMonth | null> {
  const { sales } = useDependencies();
  return useQuery({
    queryKey: trackingKeys.earliest(),
    queryFn: async () => {
      const earliest = await sales.earliestSoldOn();
      return earliest === null ? null : yearMonthOf(earliest);
    },
  });
}
