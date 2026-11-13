import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { SaleRecordCursor, SaleRecordPage } from '../data/sale-repository';
import { salesKeys } from './query-keys';

/** Tamaño de página por defecto del historial. */
export const DEFAULT_RECENT_SALES_PAGE_SIZE = 20;

/** Historial de ventas, de la más reciente a la más antigua, paginado con el cursor *keyset*. */
export function useRecentSales(
  pageSize: number = DEFAULT_RECENT_SALES_PAGE_SIZE,
): UseInfiniteQueryResult<InfiniteData<SaleRecordPage>> {
  const { sales } = useDependencies();
  return useInfiniteQuery({
    queryKey: salesKeys.recent(pageSize),
    initialPageParam: undefined as SaleRecordCursor | undefined,
    queryFn: ({ pageParam }) => sales.listRecent(pageSize, pageParam),
    getNextPageParam: (lastPage) => lastPage.next ?? undefined,
  });
}
