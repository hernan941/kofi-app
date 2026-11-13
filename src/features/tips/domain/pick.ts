import { activeTriggers, type TipContext } from './context';
import { TIP_CATEGORIES, type Tip, type TipId, type TipTrigger, type TipView } from './tip';

/** Orden de prioridad entre contextos activos. */
export const TRIGGER_PRIORITY: readonly TipTrigger[] = [
  'no_costs',
  'first_sale',
  'fair_sale',
  'streak',
  'no_channel',
];

/** Contextos cuyos consejos solo se eligen después de una venta si el contexto está activo. */
export const EXCLUSIVE_TRIGGERS: ReadonlySet<TipTrigger> = new Set<TipTrigger>(['first_sale']);

/**
 * Orden de rotación determinista: alterna categorías (el primero de cada categoría en el orden
 * de `TIP_CATEGORIES`, después el segundo, y así) respetando el orden del catálogo dentro de cada una.
 */
export function rotationOrder(tips: readonly Tip[]): readonly Tip[] {
  const byCategory = TIP_CATEGORIES.map((category) =>
    tips.filter((tip) => tip.category === category),
  );
  const rounds = Math.max(0, ...byCategory.map((group) => group.length));
  const ordered: Tip[] = [];
  for (let round = 0; round < rounds; round += 1) {
    for (const group of byCategory) {
      const tip = group[round];
      if (tip !== undefined) {
        ordered.push(tip);
      }
    }
  }
  return ordered;
}

function leastRecentlySeen(
  candidates: readonly Tip[],
  views: ReadonlyMap<TipId, TipView>,
): Tip | null {
  let chosen: Tip | null = null;
  let chosenAt = Number.POSITIVE_INFINITY;
  for (const tip of candidates) {
    const seenAt = views.get(tip.id)?.lastSeenAt ?? Number.NEGATIVE_INFINITY;
    if (seenAt < chosenAt) {
      chosen = tip;
      chosenAt = seenAt;
    }
  }
  return chosen;
}

/**
 * Elige el consejo de después de una venta:
 * 1. Elegibles: todos, salvo los de un contexto exclusivo que no está activo.
 * 2. Para cada contexto activo, en `TRIGGER_PRIORITY`: el primer elegible sin ver con ese
 *    contexto, según `rotationOrder`.
 * 3. Si no hay: el primer elegible sin ver según `rotationOrder`.
 * 4. Si todos se vieron: el de menor `lastSeenAt`; si empatan, el primero según `rotationOrder`.
 * 5. Sin elegibles: `null`.
 * Las vistas de ids que ya no están en el catálogo se ignoran.
 */
export function pickTipAfterSale(
  tips: readonly Tip[],
  views: ReadonlyMap<TipId, TipView>,
  context: TipContext,
): Tip | null {
  const active = activeTriggers(context);
  const eligible = rotationOrder(
    tips.filter(
      (tip) =>
        tip.trigger === null || !EXCLUSIVE_TRIGGERS.has(tip.trigger) || active.has(tip.trigger),
    ),
  );
  const unseen = eligible.filter((tip) => !views.has(tip.id));
  for (const trigger of TRIGGER_PRIORITY) {
    if (active.has(trigger)) {
      const prioritized = unseen.find((tip) => tip.trigger === trigger);
      if (prioritized !== undefined) {
        return prioritized;
      }
    }
  }
  return unseen[0] ?? leastRecentlySeen(eligible, views);
}
