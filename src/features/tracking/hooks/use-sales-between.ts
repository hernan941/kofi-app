import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { SaleRecord } from '@/features/sales/domain';
import type { LocalDateRange } from '@/shared/domain';

import { trackingKeys } from './query-keys';

/** Registros de ventas del rango cerrado; el rango forma parte de la clave. */
export function useSalesBetween(range: LocalDateRange): UseQueryResult<readonly SaleRecord[]> {
  const { sales } = useDependencies();
  return useQuery({
    queryKey: trackingKeys.salesBetween(range.start, range.end),
    queryFn: () => sales.listBetween(range.start, range.end),
  });
}
