import { useMemo } from 'react';

import { buildSaleRecordView, useProductsByIds, type SaleRecordView } from '@/features/sales';
import { hasItems } from '@/features/sales/domain';
import type { LocalDate, ProductId } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';

import { buildDayDetail, type DayDetail } from '../domain';
import type { LoadStatus } from './use-home-summary';
import { useSalesBetween } from './use-sales-between';

/** Resultado de {@link useDayDetail}; `detail` solo existe con `status: 'ready'`. */
export interface DayDetailState {
  readonly status: LoadStatus;
  readonly detail: DayDetail | null;
  /** Registros con ítems del día, en el orden en que se registraron. */
  readonly records: readonly SaleRecordView[];
  readonly refetch: () => void;
}

/**
 * Detalle de un día: una consulta acotada a ese día más los productos para mostrar los
 * nombres actuales (`SaleRecordView`). Tolera productos desconocidos o archivados.
 */
export function useDayDetail(date: LocalDate): DayDetailState {
  const today = useToday();
  const range = useMemo(() => ({ start: date, end: date }), [date]);
  const salesQuery = useSalesBetween(range);
  const records = salesQuery.data;
  const productIds = useMemo(
    () =>
      [
        ...new Set(records?.flatMap((record) => record.items.map((item) => item.productId))),
      ] satisfies ProductId[],
    [records],
  );
  const productsQuery = useProductsByIds(productIds);
  const products = productsQuery.data;
  const ready = useMemo(() => {
    if (records === undefined || products === undefined) {
      return null;
    }
    const byId = new Map(products.map((product) => [product.id, product]));
    const ordered = records
      .filter(hasItems)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    return {
      detail: buildDayDetail(date, today, records),
      views: ordered.map((record) => buildSaleRecordView(record, byId)),
    };
  }, [records, products, date, today]);
  const refetch = () => {
    void salesQuery.refetch();
    void productsQuery.refetch();
  };
  if (salesQuery.isError || productsQuery.isError) {
    return { status: 'error', detail: null, records: [], refetch };
  }
  return {
    status: ready === null ? 'pending' : 'ready',
    detail: ready?.detail ?? null,
    records: ready?.views ?? [],
    refetch,
  };
}
