import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { Product } from '../domain';
import { productKeys } from './query-keys';
import { sortProductsForList } from './sort-products';

/** Productos activos, ordenados para la lista. */
export function useActiveProducts(): UseQueryResult<readonly Product[]> {
  const { products } = useDependencies();
  return useQuery({
    queryKey: productKeys.active(),
    queryFn: () => products.listActive(),
    select: sortProductsForList,
  });
}
