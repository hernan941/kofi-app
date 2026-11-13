import { clpSchema, type Clp, type LocalDateRange } from '@/shared/domain';
import { MAX_SALE_TOTAL, recordTotal, type SaleRecord } from '@/features/sales/domain';

const PERCENT = 100;

/** Registros con `soldOn` dentro del rango cerrado (defensa: la consulta ya viene acotada). */
export function recordsBetween(
  records: readonly SaleRecord[],
  range: LocalDateRange,
): readonly SaleRecord[] {
  return records.filter((record) => record.soldOn >= range.start && record.soldOn <= range.end);
}

/** Σ `recordTotal` del rango; satura en `MAX_SALE_TOTAL` y los registros sin ítems suman 0 (ADR-007, regla 15). */
export function totalBetween(records: readonly SaleRecord[], range: LocalDateRange): Clp {
  const total = recordsBetween(records, range).reduce(
    (sum, record) => sum + recordTotal(record),
    0,
  );
  return clpSchema.parse(Math.min(total, MAX_SALE_TOTAL));
}

/**
 * Comparación suave entre dos períodos (D-19); nunca divide por cero. `no_data`: ni este tramo
 * ni el anterior tienen ventas. `first`: el anterior está en $0 y este no, así que no hay porcentaje.
 */
export type PeriodComparison =
  | { readonly kind: 'no_data' }
  | { readonly kind: 'first' }
  | { readonly kind: 'same' }
  | { readonly kind: 'up' | 'down'; readonly difference: Clp; readonly percent: number };

/** `percent` = round(|actual − anterior| / anterior × 100), solo con anterior > 0. */
export function compareTotals(current: Clp, previous: Clp): PeriodComparison {
  if (previous === 0) {
    return current === 0 ? { kind: 'no_data' } : { kind: 'first' };
  }
  if (current === previous) {
    return { kind: 'same' };
  }
  const difference = clpSchema.parse(Math.abs(current - previous));
  return {
    kind: current > previous ? 'up' : 'down',
    difference,
    percent: Math.round((difference / previous) * PERCENT),
  };
}
