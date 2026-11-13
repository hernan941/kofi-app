import { useMemo } from 'react';

import { useProductsByIds } from '@/features/sales';
import { compareProductsForList, type Product } from '@/features/products/domain';
import { monthRangeOf, type Clp, type ProductId, type YearMonth } from '@/shared/domain';

import { monthlySummary, type MonthlySummary, type ProfitSummary } from '../domain';
import type { LoadStatus } from './use-home-summary';
import { useProfit } from './use-profit';
import { useSalesBetween } from './use-sales-between';

/** Nombre actual de un producto destacado, con el indicador de archivado (`name` es `null` si el producto no existe). */
export interface ProductNameView {
  readonly productId: ProductId;
  readonly name: string | null;
  readonly isArchived: boolean;
  readonly revenue: Clp;
}

/** Resultado de {@link useMonthlySummary}. */
export interface MonthlySummaryState {
  readonly status: LoadStatus;
  readonly summary: MonthlySummary | null;
  /** Productos más vendidos, ordenados por nombre (D-31); los que ya no existen van al final. */
  readonly topProductNames: readonly ProductNameView[];
  readonly profit: ProfitSummary | null;
  readonly refetch: () => void;
}

function nameTopProducts(
  summary: MonthlySummary,
  products: readonly Product[],
): readonly ProductNameView[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const known = summary.topProducts
    .flatMap((top) => {
      const product = byId.get(top.productId);
      return product === undefined ? [] : [{ top, product }];
    })
    .sort((a, b) => compareProductsForList(a.product, b.product))
    .map(({ top, product }) => ({
      productId: top.productId,
      name: product.name,
      isArchived: product.archivedAt !== null,
      revenue: top.revenue,
    }));
  const unknown = summary.topProducts
    .filter((top) => !byId.has(top.productId))
    .map((top) => ({
      productId: top.productId,
      name: null,
      isArchived: true,
      revenue: top.revenue,
    }));
  return [...known, ...unknown];
}

/** Resumen de un mes (D-20): ventas del mes, productos destacados con su nombre actual y ganancia. */
export function useMonthlySummary(month: YearMonth): MonthlySummaryState {
  const range = useMemo(() => monthRangeOf(month), [month]);
  const query = useSalesBetween(range);
  const records = query.data;
  const summary = useMemo(
    () => (records === undefined ? null : monthlySummary(records, month)),
    [records, month],
  );
  const { profit } = useProfit(records);
  const topIds = useMemo(() => summary?.topProducts.map((top) => top.productId) ?? [], [summary]);
  const productsQuery = useProductsByIds(topIds);
  const products = productsQuery.data;
  const topProductNames = useMemo(
    () => (summary === null || products === undefined ? [] : nameTopProducts(summary, products)),
    [summary, products],
  );
  const refetch = () => {
    void query.refetch();
    void productsQuery.refetch();
  };
  if (query.isError || productsQuery.isError) {
    return { status: 'error', summary: null, topProductNames: [], profit: null, refetch };
  }
  const isReady = summary !== null && (topIds.length === 0 || products !== undefined);
  return {
    status: isReady ? 'ready' : 'pending',
    summary: isReady ? summary : null,
    topProductNames: isReady ? topProductNames : [],
    profit,
    refetch,
  };
}
