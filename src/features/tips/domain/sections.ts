import { TIP_CATEGORIES, type Tip, type TipCategory, type TipId, type TipView } from './tip';

/** Un consejo de la lista con su estado de visto. */
export interface TipListItem {
  readonly tip: Tip;
  readonly seen: boolean;
}

/** Consejos de una categoría. */
export interface TipSection {
  readonly category: TipCategory;
  readonly items: readonly TipListItem[];
}

/** Una sección por categoría con consejos, en el orden de `TIP_CATEGORIES`; dentro, el orden del catálogo. */
export function tipSections(
  tips: readonly Tip[],
  views: ReadonlyMap<TipId, TipView>,
): readonly TipSection[] {
  return TIP_CATEGORIES.map((category) => ({
    category,
    items: tips
      .filter((tip) => tip.category === category)
      .map((tip) => ({ tip, seen: views.has(tip.id) })),
  })).filter((section) => section.items.length > 0);
}

/** El consejo con ese id, o `null` si no está en el catálogo. */
export function findTip(tips: readonly Tip[], id: TipId): Tip | null {
  return tips.find((tip) => tip.id === id) ?? null;
}
