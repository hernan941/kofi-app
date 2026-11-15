import { useMemo } from 'react';

import type { SaleRecordId } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';
import { ErrorState, LoadingState, Screen, ScreenHeader, useAppToast } from '@/shared/ui';

import { SALE_ERROR_MESSAGES } from '../components/error-messages';
import { SaleForm } from '../components/sale-form';
import { toSaleFormValues, toSaveSaleRecordCommand } from '../components/sale-form-schema';
import { productIdsOf } from '../domain';
import { useProductsByIds } from '../hooks/use-products-by-ids';
import { useSaleRecord } from '../hooks/use-sale-record';
import { useSaveSaleRecord } from '../hooks/use-save-sale-record';
import { useSellableProducts } from '../hooks/use-sellable-products';
import type { SaleSavedOutcome } from '../use-cases/save-sale-record';
import { SaleNotFound } from './sale-detail-screen';

/** Props of {@link EditSaleScreen}. */
export interface EditSaleScreenProps {
  readonly saleRecordId: SaleRecordId;
  /** Guardó los cambios: la ruta vuelve al detalle. */
  readonly onSaved: (outcome: SaleSavedOutcome) => void;
  /** Se quitaron todos los productos y se confirmó: la venta se borró. */
  readonly onDeleted: () => void;
  readonly onCancel: () => void;
}

const RECORD_NOT_FOUND_MESSAGE = SALE_ERROR_MESSAGES.record_not_found;

/**
 * Editar venta (3.9): el formulario con los valores del registro (también los productos
 * archivados). Guardar no celebra: avisa y vuelve. Quitar todos los productos, con
 * confirmación, borra la venta.
 */
export function EditSaleScreen({
  saleRecordId,
  onSaved,
  onDeleted,
  onCancel,
}: EditSaleScreenProps) {
  const recordQuery = useSaleRecord(saleRecordId);
  const record = recordQuery.data ?? null;
  const productIds = useMemo(() => productIdsOf(record), [record]);
  const productsQuery = useProductsByIds(productIds);
  const sellable = useSellableProducts();
  const today = useToday();
  const save = useSaveSaleRecord();
  const toast = useAppToast();

  const catalog = useMemo(
    () => new Map((productsQuery.data ?? []).map((product) => [product.id, product])),
    [productsQuery.data],
  );
  const initialValues = useMemo(
    () => toSaleFormValues(record, today, [], catalog),
    [record, today, catalog],
  );
  const isPending = recordQuery.isPending || productsQuery.isPending || sellable.isPending;
  const isError = recordQuery.isError || productsQuery.isError || sellable.isError;

  return (
    <Screen>
      <ScreenHeader title="Editar venta" onBack={onCancel} />
      {isPending ? (
        <LoadingState label="Cargando venta" shape="cards" count={2} />
      ) : isError ? (
        <ErrorState
          message="No se pudo cargar esta venta. Inténtalo de nuevo."
          onRetry={() => {
            void recordQuery.refetch();
            void productsQuery.refetch();
            void sellable.refetch();
          }}
        />
      ) : record === null ? (
        <SaleNotFound onBack={onCancel} />
      ) : (
        <SaleForm
          mode="edit"
          initialValues={initialValues}
          sellable={sellable.data ?? []}
          catalog={catalog}
          onSubmit={async (output) => {
            try {
              return await save.mutateAsync(toSaveSaleRecordCommand(saleRecordId, output));
            } catch {
              toast.showError('No se pudo guardar la venta. Inténtalo de nuevo.');
              return null;
            }
          }}
          onSaved={(result) => {
            if (result.kind === 'deleted') {
              toast.showSuccess('Venta borrada');
              onDeleted();
              return;
            }
            toast.showSuccess(
              result.outcome.clearedNoSalesWeek === null
                ? 'Cambios guardados'
                : 'Cambios guardados. Quitamos la marca de "no vendí" de esa semana.',
            );
            onSaved(result.outcome);
          }}
          onUnmappedErrors={(errors, leaveWithoutAsking) => {
            if (errors.some((error) => error.code === 'record_not_found')) {
              toast.showError(RECORD_NOT_FOUND_MESSAGE);
              leaveWithoutAsking(onCancel);
              return;
            }
            toast.showError(SALE_ERROR_MESSAGES[errors[0]?.code ?? 'required']);
          }}
        />
      )}
    </Screen>
  );
}
