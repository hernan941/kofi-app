import {
  clpSchema,
  compareYearMonth,
  monthRangeOf,
  yearMonthOf,
  type Clp,
  type LocalDate,
  type ProductId,
  type YearMonth,
} from '@/shared/domain';
import {
  MAX_SALE_TOTAL,
  SALE_CHANNELS,
  hasItems,
  type SaleChannel,
  type SaleRecord,
} from '@/features/sales/domain';

import { totalBetween } from './totals';

/** Producto con su monto vendido en el mes. */
export interface RankedProduct {
  readonly productId: ProductId;
  readonly revenue: Clp;
}

/** Canal con su monto vendido en el mes. */
export interface RankedChannel {
  readonly channel: SaleChannel;
  readonly revenue: Clp;
}

/** Resumen de un mes (D-20). */
export interface MonthlySummary {
  readonly month: YearMonth;
  readonly total: Clp;
  /** Registros con al menos un ítem activo. */
  readonly recordCount: number;
  /**
   * Los productos de mayor Σ cantidad × `unitPrice`, todos los empatados; vacío si no hay
   * ventas o el máximo es $0. Orden por `productId` (el hook reordena por nombre).
   */
  readonly topProducts: readonly RankedProduct[];
  /** Igual por canal; los registros sin canal no compiten; orden de `SALE_CHANNELS`. */
  readonly topChannels: readonly RankedChannel[];
}

function addTo<Key>(totals: Map<Key, number>, key: Key, amount: number): void {
  totals.set(key, (totals.get(key) ?? 0) + amount);
}

function topEntries<Key>(
  totals: ReadonlyMap<Key, number>,
  compareKeys: (a: Key, b: Key) => number,
): readonly { readonly key: Key; readonly revenue: Clp }[] {
  const maximum = Math.max(0, ...totals.values());
  if (maximum === 0) {
    return [];
  }
  return [...totals.entries()]
    .filter(([, revenue]) => revenue === maximum)
    .map(([key, revenue]) => ({ key, revenue: clpSchema.parse(Math.min(revenue, MAX_SALE_TOTAL)) }))
    .sort((a, b) => compareKeys(a.key, b.key));
}

function compareText(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** Total, cantidad de registros, productos y canales con más monto del mes (D-20). */
export function monthlySummary(records: readonly SaleRecord[], month: YearMonth): MonthlySummary {
  const range = monthRangeOf(month);
  const inMonth = records.filter(
    (record) => record.soldOn >= range.start && record.soldOn <= range.end && hasItems(record),
  );
  const byProduct = new Map<ProductId, number>();
  const byChannel = new Map<SaleChannel, number>();
  for (const record of inMonth) {
    for (const item of record.items) {
      const revenue = item.quantity * item.unitPrice;
      addTo(byProduct, item.productId, revenue);
      if (record.channel !== null) {
        addTo(byChannel, record.channel, revenue);
      }
    }
  }
  return {
    month,
    total: totalBetween(inMonth, range),
    recordCount: inMonth.length,
    topProducts: topEntries(byProduct, compareText).map(({ key, revenue }) => ({
      productId: key,
      revenue,
    })),
    topChannels: topEntries(
      byChannel,
      (a, b) => SALE_CHANNELS.indexOf(a) - SALE_CHANNELS.indexOf(b),
    ).map(({ key, revenue }) => ({ channel: key, revenue })),
  };
}

/** Límites de la navegación entre meses (D-30). */
export interface MonthNavigation {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

/** Atrás hasta `earliestMonth` (sin ventas no hay atrás); adelante hasta `currentMonth`. */
export function monthNavigation(
  month: YearMonth,
  currentMonth: YearMonth,
  earliestMonth: YearMonth | null,
): MonthNavigation {
  return {
    canGoBack: earliestMonth !== null && compareYearMonth(month, earliestMonth) > 0,
    canGoForward: compareYearMonth(month, currentMonth) < 0,
  };
}

/** `null` o un mes futuro dan el mes de `today`; si no, el pedido. */
export function resolveMonth(requested: YearMonth | null, today: LocalDate): YearMonth {
  const current = yearMonthOf(today);
  if (requested === null || compareYearMonth(requested, current) > 0) {
    return current;
  }
  return requested;
}
