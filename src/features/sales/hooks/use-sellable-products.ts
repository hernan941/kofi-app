import { useMemo } from 'react';

import { activeVersions, useActiveProducts } from '@/features/products';
import type { Product } from '@/features/products/domain';

/** Lo que la pantalla necesita de la lista de productos vendibles. */
export interface SellableProductsState {
  /** `undefined` mientras carga o si falló. */
  readonly data: readonly Product[] | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly refetch: () => Promise<unknown>;
}

/**
 * Productos que se pueden agregar a una venta: activos (los archivados ya vienen excluidos)
 * y con al menos una versión activa, en el orden de la lista de productos (D-31).
 */
export function useSellableProducts(): SellableProductsState {
  const query = useActiveProducts();
  const { data: active } = query;
  const data = useMemo(
    () => active?.filter((product) => activeVersions(product).length > 0),
    [active],
  );
  return {
    data,
    isPending: query.isPending,
    isError: query.isError,
    refetch: () => query.refetch(),
  };
}
