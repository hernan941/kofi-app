import type { TipId, TipView } from '../domain';

/** Indexa las vistas por id, como lo espera el dominio. */
export function viewsById(views: readonly TipView[]): ReadonlyMap<TipId, TipView> {
  return new Map(views.map((view) => [view.tipId, view]));
}
