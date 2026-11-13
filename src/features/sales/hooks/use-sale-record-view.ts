import { useMemo } from 'react';

import type { ProductId, SaleRecordId } from '@/shared/domain';

import { buildSaleRecordView, type SaleRecordView } from '../domain';
import { useProductsByIds } from './use-products-by-ids';
import { useSaleRecord } from './use-sale-record';

/** Estado de la carga de un registro para mostrar. */
export type SaleRecordViewStatus = 'pending' | 'error' | 'not_found' | 'ready';

/** Resultado de {@link useSaleRecordView}; `view` solo existe con `status: 'ready'`. */
export interface SaleRecordViewState {
  readonly status: SaleRecordViewStatus;
  readonly view: SaleRecordView | null;
  readonly refetch: () => void;
}

/**
 * Un registro con los nombres actuales de sus productos y versiones, la portada y el
 * indicador de "archivado". Tolera productos archivados o desconocidos (una venta pasada
 * nunca falla por eso). Un id sin registro es `not_found`, no un error.
 */
export function useSaleRecordView(id: SaleRecordId): SaleRecordViewState {
  const recordQuery = useSaleRecord(id);
  const record = recordQuery.data ?? null;
  const productIds = useMemo(
    () => [...new Set(record?.items.map((item) => item.productId) ?? [])] satisfies ProductId[],
    [record],
  );
  const productsQuery = useProductsByIds(productIds);
  const products = productsQuery.data;

  const view = useMemo(
    () =>
      record === null || products === undefined
        ? null
        : buildSaleRecordView(record, new Map(products.map((product) => [product.id, product]))),
    [record, products],
  );

  const refetch = () => {
    void recordQuery.refetch();
    void productsQuery.refetch();
  };

  if (recordQuery.isError || productsQuery.isError) {
    return { status: 'error', view: null, refetch };
  }
  if (recordQuery.isPending) {
    return { status: 'pending', view: null, refetch };
  }
  if (record === null) {
    return { status: 'not_found', view: null, refetch };
  }
  if (view === null) {
    return { status: 'pending', view: null, refetch };
  }
  return { status: 'ready', view, refetch };
}
