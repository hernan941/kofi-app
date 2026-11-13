import {
  clpSchema,
  signedClpSchema,
  type Clp,
  type ProductVersionId,
  type SignedClp,
} from '@/shared/domain';
import { MAX_SALE_TOTAL, effectiveUnitCost, type SaleRecord } from '@/features/sales/domain';

const MAX_PROFIT: number = MAX_SALE_TOTAL;

/** Ganancia aproximada y qué parte de lo vendido tenía costo (ADR-007). */
export interface ProfitSummary {
  readonly profit: SignedClp;
  readonly revenueWithCost: Clp;
  readonly revenueTotal: Clp;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Σ cantidad × (precio − costo efectivo) solo sobre los ítems con costo efectivo
 * (`effectiveUnitCost(item, map.get(item.productVersionId) ?? null)`, D-26).
 * Devuelve `null` si ningún ítem tiene costo efectivo. Satura en ±999.999.999.
 */
export function approximateProfit(
  records: readonly SaleRecord[],
  currentCostByVersion: ReadonlyMap<ProductVersionId, Clp | null>,
): ProfitSummary | null {
  let profit = 0;
  let revenueWithCost = 0;
  let revenueTotal = 0;
  let hasCost = false;
  for (const record of records) {
    for (const item of record.items) {
      const revenue = item.quantity * item.unitPrice;
      revenueTotal += revenue;
      const cost = effectiveUnitCost(item, currentCostByVersion.get(item.productVersionId) ?? null);
      if (cost !== null) {
        hasCost = true;
        revenueWithCost += revenue;
        profit += item.quantity * (item.unitPrice - cost);
      }
    }
  }
  if (!hasCost) {
    return null;
  }
  return {
    profit: signedClpSchema.parse(clamp(profit, -MAX_PROFIT, MAX_PROFIT)),
    revenueWithCost: clpSchema.parse(Math.min(revenueWithCost, MAX_SALE_TOTAL)),
    revenueTotal: clpSchema.parse(Math.min(revenueTotal, MAX_SALE_TOTAL)),
  };
}

/** `partial` si `revenueWithCost < revenueTotal` (texto de D-15); si no, `full`. */
export function profitCoverage(summary: ProfitSummary): 'full' | 'partial' {
  return summary.revenueWithCost < summary.revenueTotal ? 'partial' : 'full';
}

/** Versiones de ítems sin `unitCost`, sin repetir y ordenadas: lo único que hay que pedir a `currentCostsFor`. */
export function versionIdsNeedingCurrentCost(
  records: readonly SaleRecord[],
): readonly ProductVersionId[] {
  const ids = new Set<ProductVersionId>();
  for (const record of records) {
    for (const item of record.items) {
      if (item.unitCost === null) {
        ids.add(item.productVersionId);
      }
    }
  }
  return [...ids].sort();
}
