import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { Product } from '../domain';
import { productKeys } from './query-keys';
import { sortProductsForList } from './sort-products';

/** Productos archivados, ordenados para la lista. */
export function useArchivedProducts(): UseQueryResult<readonly Product[]> {
  const { products } = useDependencies();
  return useQuery({
    queryKey: productKeys.archived(),
    queryFn: () => products.listArchived(),
    select: sortProductsForList,
  });
}
