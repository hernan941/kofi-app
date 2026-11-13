import { useMemo } from 'react';

import type { ProductId } from '@/shared/domain';
import { ErrorState, LoadingState, Screen, ScreenHeader, useAppToast } from '@/shared/ui';

import { PRODUCT_ERROR_MESSAGES } from '../components/error-messages';
import { ProductForm } from '../components/product-form';
import { toProductFormValues, toSaveProductCommand } from '../components/product-form-schema';
import { useProduct } from '../hooks/use-product';
import { useSaveProduct } from '../hooks/use-save-product';
import { useVersionIdsWithSales } from '../hooks/use-version-ids-with-sales';
import { ProductNotFound } from './product-detail-screen';

/** Props of {@link EditProductScreen}. */
export interface EditProductScreenProps {
  readonly productId: ProductId;
  readonly onBack: () => void;
  readonly onSaved: (id: ProductId) => void;
}

/**
 * Edit product (design 3.6): the form with the values of the product, also for an archived
 * one (it stays archived). The sales hint does not block the form.
 */
export function EditProductScreen({ productId, onBack, onSaved }: EditProductScreenProps) {
  const query = useProduct(productId);
  const withSales = useVersionIdsWithSales(productId);
  const save = useSaveProduct();
  const toast = useAppToast();
  const product = query.data ?? null;
  const initialValues = useMemo(() => toProductFormValues(product), [product]);

  return (
    <Screen>
      <ScreenHeader title="Editar producto" onBack={onBack} />
      {query.isPending ? (
        <LoadingState label="Cargando producto" shape="cards" count={2} />
      ) : query.isError ? (
        <ErrorState
          message="No se pudo cargar este producto. Inténtalo de nuevo."
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : product === null ? (
        <ProductNotFound onBack={onBack} />
      ) : (
        <ProductForm
          initialValues={initialValues}
          productId={productId}
          versionIdsWithSales={withSales.data}
          notice={
            product.archivedAt === null
              ? undefined
              : 'Este producto está archivado. Puedes corregirlo y seguirá archivado hasta que elijas "Volver a usar".'
          }
          onSubmit={async (output) => {
            try {
              return await save.mutateAsync(toSaveProductCommand(productId, output));
            } catch {
              toast.showError('No se pudo guardar. Inténtalo de nuevo.');
              return null;
            }
          }}
          onSaved={(id) => {
            toast.showSuccess('Cambios guardados');
            onSaved(id);
          }}
          onUnmappedErrors={(errors, leaveWithoutAsking) => {
            if (errors.some((error) => error.code === 'product_not_found')) {
              toast.showError('No encontramos este producto. Puede que ya no exista.');
              leaveWithoutAsking(onBack);
              return;
            }
            const [first] = errors;
            if (first) toast.showError(PRODUCT_ERROR_MESSAGES[first.code]);
          }}
        />
      )}
    </Screen>
  );
}
