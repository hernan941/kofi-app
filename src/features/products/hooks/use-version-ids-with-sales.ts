import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { ProductId, ProductVersionId } from '@/shared/domain';

import { productVersionUsageKeys } from './query-keys';

/**
 * Pista para la UI (explicar "se archivará porque tiene ventas"); la decisión real la toma
 * el caso de uso dentro de su transacción.
 */
export function useVersionIdsWithSales(
  productId: ProductId,
): UseQueryResult<ReadonlySet<ProductVersionId>> {
  const { products } = useDependencies();
  return useQuery({
    queryKey: productVersionUsageKeys.withSales(productId),
    queryFn: () => products.versionIdsWithSales(productId),
  });
}
