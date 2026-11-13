import { epochMsSchema, type EpochMs } from '@/shared/domain';

import { tipIdSchema, type Tip, type TipId, type TipView } from '../tip';

/** Id de consejo de prueba. */
export function tipId(value: string): TipId {
  return tipIdSchema.parse(value);
}

/** Instante de prueba. */
export function at(value: number): EpochMs {
  return epochMsSchema.parse(value);
}

/** Consejo de prueba; por defecto de registro y sin contexto. */
export function makeTip(id: string, overrides: Partial<Omit<Tip, 'id'>> = {}): Tip {
  return {
    id: tipId(id),
    category: 'recording',
    title: `Título ${id}`,
    body: `Cuerpo ${id}`,
    trigger: null,
    ...overrides,
  };
}

/** Vista de prueba; `firstSeenAt` por defecto es igual a `lastSeenAt`. */
export function makeView(id: string, lastSeenAt: number, firstSeenAt = lastSeenAt): TipView {
  return { tipId: tipId(id), firstSeenAt: at(firstSeenAt), lastSeenAt: at(lastSeenAt) };
}

/** Mapa de vistas por id, como lo entrega el repositorio. */
export function viewsOf(...views: readonly TipView[]): ReadonlyMap<TipId, TipView> {
  return new Map(views.map((view) => [view.tipId, view]));
}
