import { useQuery } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { Clp, ProductVersionId } from '@/shared/domain';

import { trackingCostKeys } from './query-keys';

const NO_COSTS: ReadonlyMap<ProductVersionId, Clp | null> = new Map();

/** Resultado de {@link useCurrentCosts}. */
export interface CurrentCostsState {
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly costs: ReadonlyMap<ProductVersionId, Clp | null>;
}

/**
 * Costo actual de las versiones pedidas (D-26). Sin ids no consulta y devuelve un mapa vacío.
 * La clave depende del conjunto de ids, así que se recarga cuando cambia un costo.
 */
export function useCurrentCosts(ids: readonly ProductVersionId[]): CurrentCostsState {
  const { products } = useDependencies();
  const hasIds = ids.length > 0;
  const query = useQuery({
    queryKey: trackingCostKeys.forVersions(ids),
    queryFn: () => products.currentCostsFor(ids),
    enabled: hasIds,
  });
  return {
    isPending: hasIds && query.isPending,
    isError: hasIds && query.isError,
    costs: query.data ?? NO_COSTS,
  };
}
