import { useMemo, useState, type ReactNode } from 'react';

import { useToday } from '@/shared/lib/time/use-today';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PackageIcon,
  Screen,
  ScreenHeader,
  useAppToast,
} from '@/shared/ui';
import { View } from 'react-native';

import type { Product } from '@/features/products/domain';
import type { Clp, ProductId } from '@/shared/domain';
import { SALE_ERROR_MESSAGES } from '../components/error-messages';
import { NoSalesSection } from '../components/no-sales-section';
import { SaleForm } from '../components/sale-form';
import {
  outputSummary,
  toSaleFormValues,
  toSaveSaleRecordCommand,
} from '../components/sale-form-schema';
import { SaleSavedCelebration, type AfterSaveControls } from '../components/sale-saved-celebration';
import { useFinishOnLeave } from '@/shared/lib/use-finish-on-leave';
import { useSaveSaleRecord } from '../hooks/use-save-sale-record';
import { useSellableProducts } from '../hooks/use-sellable-products';
import type { SaleSavedOutcome } from '../use-cases/save-sale-record';

const EMPTY_CATALOG: ReadonlyMap<ProductId, Product> = new Map();

/** Props of {@link NewSaleScreen}. */
export interface NewSaleScreenProps {
  /** Se llama al cerrar la celebración ("Listo", volver, gesto o botón atrás). */
  readonly onFinished: (outcome: SaleSavedOutcome) => void;
  /** Sin productos: lleva a crear uno. */
  readonly onCreateProduct: () => void;
  readonly onCancel: () => void;
  /** Lo que se dibuja en el lugar reservado de la celebración (el consejo de F6). */
  readonly renderAfterSave?: (outcome: SaleSavedOutcome, controls: AfterSaveControls) => ReactNode;
}

/** Lo que se guardó, para dibujar la celebración. */
interface SavedSale {
  readonly outcome: SaleSavedOutcome;
  readonly total: Clp;
  readonly productCount: number;
}

/** Props de la celebración con el cierre unificado. */
function Celebration({
  saved,
  onFinished,
  renderAfterSave,
}: {
  readonly saved: SavedSale;
  readonly onFinished: NewSaleScreenProps['onFinished'];
  readonly renderAfterSave: NewSaleScreenProps['renderAfterSave'];
}) {
  const today = useToday();
  const finish = useFinishOnLeave(true, () => {
    onFinished(saved.outcome);
  });
  return (
    <Screen>
      <ScreenHeader onBack={finish} />
      <SaleSavedCelebration
        outcome={saved.outcome}
        total={saved.total}
        productCount={saved.productCount}
        today={today}
        onDone={finish}
        renderAfterSave={renderAfterSave}
      />
    </Screen>
  );
}

/**
 * Registrar venta (3.1, 3.5 y 3.7): el formulario con los productos a la vista, "esta semana
 * no vendí" y, al guardar, la celebración en la misma pantalla. Sin productos invita a crear
 * uno. Las pantallas no importan el router: la ruta decide adónde ir con `onFinished`.
 */
export function NewSaleScreen({
  onFinished,
  onCreateProduct,
  onCancel,
  renderAfterSave,
}: NewSaleScreenProps) {
  const sellable = useSellableProducts();
  const today = useToday();
  const save = useSaveSaleRecord();
  const toast = useAppToast();
  const [saved, setSaved] = useState<SavedSale | null>(null);
  const products = sellable.data;
  const initialValues = useMemo(
    () => toSaleFormValues(null, today, products ?? []),
    [today, products],
  );

  if (saved !== null) {
    return <Celebration saved={saved} onFinished={onFinished} renderAfterSave={renderAfterSave} />;
  }
  return (
    <Screen>
      <ScreenHeader title="Registrar venta" onBack={onCancel} />
      {sellable.isPending ? (
        <LoadingState label="Cargando tus productos" shape="rows" count={4} />
      ) : products === undefined ? (
        <ErrorState
          message="No se pudieron cargar tus productos. Inténtalo de nuevo."
          onRetry={() => {
            void sellable.refetch();
          }}
        />
      ) : products.length === 0 ? (
        <View className="gap-6 px-4">
          <EmptyState
            icon={PackageIcon}
            title="Primero, agrega lo que vendes"
            description="Guarda un producto con su precio y después registras tus ventas en segundos."
            primaryAction={{ label: 'Agregar producto', onPress: onCreateProduct }}
          />
          <NoSalesSection />
        </View>
      ) : (
        <SaleForm
          mode="create"
          initialValues={initialValues}
          sellable={products}
          catalog={EMPTY_CATALOG}
          onSubmit={async (output) => {
            try {
              return await save.mutateAsync(toSaveSaleRecordCommand(null, output));
            } catch {
              toast.showError('No se pudo guardar la venta. Inténtalo de nuevo.');
              return null;
            }
          }}
          onSaved={(result, output) => {
            if (result.kind === 'saved') {
              setSaved({ outcome: result.outcome, ...outputSummary(output) });
            }
          }}
          onUnmappedErrors={(errors) => {
            toast.showError(SALE_ERROR_MESSAGES[errors[0]?.code ?? 'required']);
          }}
        />
      )}
    </Screen>
  );
}
