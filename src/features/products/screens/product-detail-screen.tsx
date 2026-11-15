import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { ProductId } from '@/shared/domain';
import {
  ArchiveIcon,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PencilSimpleIcon,
  PrimaryButton,
  QuestionIcon,
  Screen,
  ScreenHeader,
  SecondaryButton,
  StyledSafeAreaView,
  useAppToast,
} from '@/shared/ui';

import { PRODUCT_ERROR_MESSAGES } from '../components/error-messages';
import { ProductDetail } from '../components/product-detail';
import { activeVersions, type Product } from '../domain';
import { useProduct } from '../hooks/use-product';
import { useSetProductArchived } from '../hooks/use-set-product-archived';

/** Props of {@link ProductDetailScreen}. */
export interface ProductDetailScreenProps {
  readonly productId: ProductId;
  readonly onBack: () => void;
  readonly onEdit: () => void;
  readonly onArchived: () => void;
}

/** Props of the "not found" state, shared with the edit screen. */
export interface ProductNotFoundProps {
  readonly onBack: () => void;
}

/** State for a valid id that has no product (design 4.3). */
export function ProductNotFound({ onBack }: ProductNotFoundProps) {
  return (
    <EmptyState
      icon={QuestionIcon}
      title="No encontramos este producto"
      description="Puede que ya no exista."
      primaryAction={{ label: 'Ir a Productos', onPress: onBack }}
    />
  );
}

/**
 * Product detail (design 3.3 and 3.4). The fixed button is the main action of the moment:
 * "Editar producto", or "Volver a usar" for an archived one that can be reused. "Archivar"
 * asks first (UX-P8); "Volver a usar" does not.
 */
export function ProductDetailScreen({
  productId,
  onBack,
  onEdit,
  onArchived,
}: ProductDetailScreenProps) {
  const query = useProduct(productId);
  const setArchived = useSetProductArchived();
  const toast = useAppToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const change = async (archived: boolean) => {
    const failure = archived
      ? 'No se pudo archivar. Inténtalo de nuevo.'
      : 'No se pudo volver a usar. Inténtalo de nuevo.';
    try {
      const result = await setArchived.mutateAsync({ productId, archived });
      if (!result.ok) {
        const known = result.error.find((error) => error.code === 'no_active_version');
        toast.showError(known ? PRODUCT_ERROR_MESSAGES.no_active_version : failure);
        return;
      }
      if (archived) {
        toast.showSuccess('Producto archivado. Lo encuentras en Archivados.');
        onArchived();
      } else {
        toast.showSuccess('Listo, vuelve a estar en tu lista.');
      }
    } catch {
      toast.showError(failure);
    }
  };

  const renderBody = (product: Product) => {
    const isArchived = product.archivedAt !== null;
    const canReuse = isArchived && activeVersions(product).length > 0;
    return (
      <>
        <ScrollView contentContainerClassName="gap-8 pb-6">
          <ProductDetail product={product} />
          {canReuse || !isArchived ? (
            <View className="px-4">
              {isArchived ? (
                <SecondaryButton label="Editar" icon={PencilSimpleIcon} onPress={onEdit} />
              ) : (
                <SecondaryButton
                  label="Archivar"
                  icon={ArchiveIcon}
                  onPress={() => {
                    setIsConfirmOpen(true);
                  }}
                />
              )}
            </View>
          ) : null}
        </ScrollView>
        <StyledSafeAreaView edges={['bottom']} className="px-4 pt-2 pb-4">
          {canReuse ? (
            <PrimaryButton
              label="Volver a usar"
              onPress={() => {
                if (setArchived.isPending) return;
                void change(false);
              }}
            />
          ) : (
            <PrimaryButton label="Editar producto" icon={PencilSimpleIcon} onPress={onEdit} />
          )}
        </StyledSafeAreaView>
        <ConfirmDialog
          isOpen={isConfirmOpen}
          title={`¿Archivar ${product.name}?`}
          description="Dejará de aparecer en tu lista y al registrar ventas. Tus ventas pasadas no cambian, y puedes volver a usarlo cuando quieras desde Archivados."
          confirmLabel="Archivar"
          onConfirm={() => {
            setIsConfirmOpen(false);
            void change(true);
          }}
          onCancel={() => {
            setIsConfirmOpen(false);
          }}
        />
      </>
    );
  };

  return (
    <Screen>
      <ScreenHeader title={query.data?.name} onBack={onBack} />
      <View className="flex-1">
        {query.isPending ? (
          <LoadingState label="Cargando producto" shape="cards" count={2} />
        ) : query.isError ? (
          <ErrorState
            message="No se pudo cargar este producto. Inténtalo de nuevo."
            onRetry={() => {
              void query.refetch();
            }}
          />
        ) : query.data === null ? (
          <ProductNotFound onBack={onBack} />
        ) : (
          renderBody(query.data)
        )}
      </View>
    </Screen>
  );
}
