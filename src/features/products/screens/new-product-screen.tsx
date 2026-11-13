import type { ProductId } from '@/shared/domain';
import { Screen, ScreenHeader, useAppToast } from '@/shared/ui';

import { PRODUCT_ERROR_MESSAGES } from '../components/error-messages';
import { ProductForm } from '../components/product-form';
import { toProductFormValues, toSaveProductCommand } from '../components/product-form-schema';
import { useSaveProduct } from '../hooks/use-save-product';

/** Props of {@link NewProductScreen}. */
export interface NewProductScreenProps {
  readonly onBack: () => void;
  readonly onSaved: (id: ProductId) => void;
}

const INITIAL_VALUES = toProductFormValues(null);

/** Create product (design 3.5): the form with empty values; on success the route goes back to the list. */
export function NewProductScreen({ onBack, onSaved }: NewProductScreenProps) {
  const save = useSaveProduct();
  const toast = useAppToast();
  return (
    <Screen>
      <ScreenHeader title="Nuevo producto" onBack={onBack} />
      <ProductForm
        initialValues={INITIAL_VALUES}
        onSubmit={async (output) => {
          try {
            return await save.mutateAsync(toSaveProductCommand(null, output));
          } catch {
            toast.showError('No se pudo guardar. Inténtalo de nuevo.');
            return null;
          }
        }}
        onSaved={(id) => {
          toast.showSuccess('Producto guardado');
          onSaved(id);
        }}
        onUnmappedErrors={(errors) => {
          const [first] = errors;
          if (first) toast.showError(PRODUCT_ERROR_MESSAGES[first.code]);
        }}
      />
    </Screen>
  );
}
