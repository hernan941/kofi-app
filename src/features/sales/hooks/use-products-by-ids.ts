import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import { productKeys } from '@/features/products';
import type { Product } from '@/features/products/domain';
import type { ProductId } from '@/shared/domain';

/**
 * Productos por id para mostrar ventas: también los archivados (una venta pasada sigue
 * mostrando el nombre), y los ids desconocidos se omiten. La clave cuelga de la raíz
 * `['products']`, así que se recarga cuando cambia el catálogo.
 */
export function useProductsByIds(ids: readonly ProductId[]): UseQueryResult<readonly Product[]> {
  const { products } = useDependencies();
  return useQuery({
    queryKey: productKeys.byIds(ids),
    queryFn: () => products.findByIds(ids),
  });
}
