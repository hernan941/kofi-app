import type { SaleChannel } from '@/features/sales/domain';

import type { TipTrigger } from './tip';

/** Racha mínima, en semanas, que activa `streak`. */
export const STREAK_TIP_MIN_WEEKS = 3;

/** Hechos de la venta recién guardada que deciden la prioridad. */
export interface TipContext {
  /** Algún producto activo tiene alguna versión activa con costo (incluido $0). */
  readonly hasAnyCost: boolean;
  /** `SaleSavedOutcome.isFirstSale` (D-36). */
  readonly isFirstSale: boolean;
  readonly channel: SaleChannel | null;
  /** Semanas seguidas con registro, ya con la venta guardada. */
  readonly streakWeeks: number;
}

/**
 * Contextos activos: `no_costs` si `!hasAnyCost`; `first_sale` si `isFirstSale`; `streak` si
 * `streakWeeks >= 3`; `no_channel` si `channel === null`; `fair_sale` si `channel === 'fair'`.
 */
export function activeTriggers(context: TipContext): ReadonlySet<TipTrigger> {
  const triggers = new Set<TipTrigger>();
  if (!context.hasAnyCost) {
    triggers.add('no_costs');
  }
  if (context.isFirstSale) {
    triggers.add('first_sale');
  }
  if (context.streakWeeks >= STREAK_TIP_MIN_WEEKS) {
    triggers.add('streak');
  }
  if (context.channel === null) {
    triggers.add('no_channel');
  }
  if (context.channel === 'fair') {
    triggers.add('fair_sale');
  }
  return triggers;
}

/** Lo que `hasAnyCostLoaded` necesita saber de un producto (cualquier `Product` lo cumple). */
export interface CostBearingProduct {
  /** Instante de archivado en ms (`EpochMs` es un `number`); `null` si sigue activo. */
  readonly archivedAt: number | null;
  readonly versions: readonly {
    readonly cost: number | null;
    /** Instante de archivado en ms; `null` si la versión sigue activa. */
    readonly archivedAt: number | null;
  }[];
}

/** `true` si algún producto activo tiene una versión activa con costo cargado (incluido $0). */
export function hasAnyCostLoaded(products: readonly CostBearingProduct[]): boolean {
  return products.some(
    (product) =>
      product.archivedAt === null &&
      product.versions.some((version) => version.archivedAt === null && version.cost !== null),
  );
}
