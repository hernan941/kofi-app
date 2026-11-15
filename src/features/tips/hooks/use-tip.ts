import { useQuery } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';

import { findTip, type Tip, type TipId } from '../domain';
import { tipKeys } from './query-keys';

/** Estado del detalle de un consejo; `tip` es `null` si el id no está en el catálogo. */
export interface TipState {
  readonly status: 'pending' | 'error' | 'ready';
  readonly tip: Tip | null;
  readonly seen: boolean;
}

/** Un consejo del catálogo y si ya se vio. */
export function useTip(id: TipId): TipState {
  const { tipViews, tipCatalog } = useDependencies();
  const query = useQuery({ queryKey: tipKeys.views(), queryFn: () => tipViews.listAll() });
  return {
    status: query.isPending ? 'pending' : query.isError ? 'error' : 'ready',
    tip: findTip(tipCatalog.all(), id),
    seen: query.data?.some((view) => view.tipId === id) ?? false,
  };
}
