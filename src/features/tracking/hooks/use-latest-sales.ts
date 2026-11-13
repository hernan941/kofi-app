import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';
import { buildSaleRecordView, useProductsByIds, type SaleRecordView } from '@/features/sales';
import type { ProductId } from '@/shared/domain';

import { LATEST_SALES_LIMIT } from '../domain';
import { trackingKeys } from './query-keys';
import type { LoadStatus } from './use-home-summary';

/** Resultado de {@link useLatestSales}. */
export interface LatestSalesState {
  readonly status: LoadStatus;
  readonly sales: readonly SaleRecordView[];
  readonly refetch: () => void;
}

/**
 * Últimos registros de venta, de más reciente a más antiguo, con el nombre actual de sus
 * productos y el indicador de archivado (`SaleRecordView`). Tolera productos desconocidos.
 */
export function useLatestSales(): LatestSalesState {
  const { sales } = useDependencies();
  const recordsQuery = useQuery({
    queryKey: trackingKeys.latest(LATEST_SALES_LIMIT),
    queryFn: () => sales.listRecent(LATEST_SALES_LIMIT),
    select: (page) => page.records,
  });
  const records = recordsQuery.data;
  const productIds = useMemo(
    () =>
      [
        ...new Set(records?.flatMap((record) => record.items.map((item) => item.productId))),
      ] satisfies ProductId[],
    [records],
  );
  const productsQuery = useProductsByIds(productIds);
  const products = productsQuery.data;
  const views = useMemo(() => {
    if (records === undefined || products === undefined) {
      return null;
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    return records.map((record) => buildSaleRecordView(record, byId));
  }, [records, products]);
  const refetch = () => {
    void recordsQuery.refetch();
    void productsQuery.refetch();
  };
  if (recordsQuery.isError || productsQuery.isError) {
    return { status: 'error', sales: [], refetch };
  }
  return { status: views === null ? 'pending' : 'ready', sales: views ?? [], refetch };
}
