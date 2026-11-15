import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';

import { tipSections, type TipSection } from '../domain';
import { tipKeys } from './query-keys';
import { viewsById } from './views-by-id';

/** Estado de las secciones de la lista de consejos. */
export interface TipSectionsState {
  readonly status: 'pending' | 'error' | 'ready';
  readonly sections: readonly TipSection[];
}

/**
 * Catálogo agrupado por categoría, con los consejos vistos marcados. Si no se pueden leer los
 * vistos (`status: 'error'`), devuelve igual todo el catálogo sin marcas: los consejos están
 * en la app y se pueden leer.
 */
export function useTipSections(): TipSectionsState {
  const { tipViews, tipCatalog } = useDependencies();
  const query = useQuery({ queryKey: tipKeys.views(), queryFn: () => tipViews.listAll() });
  const views = query.data;
  const sections = useMemo(
    () => tipSections(tipCatalog.all(), viewsById(views ?? [])),
    [tipCatalog, views],
  );
  return { status: query.isPending ? 'pending' : query.isError ? 'error' : 'ready', sections };
}
