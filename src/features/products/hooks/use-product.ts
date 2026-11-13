import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { ProductId } from '@/shared/domain';

import type { Product } from '../domain';
import { productKeys } from './query-keys';

/** Un producto por id; `data === null` es "no encontrado": la screen muestra su estado, no lanza. */
export function useProduct(id: ProductId): UseQueryResult<Product | null> {
  const { products } = useDependencies();
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => products.findById(id),
  });
}
