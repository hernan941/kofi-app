import { View } from 'react-native';

import type { ProductId } from '@/shared/domain';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PackageIcon,
  PlusIcon,
  PrimaryButton,
  Screen,
  ScreenHeader,
  TextButton,
} from '@/shared/ui';

import { ProductList } from '../components/product-list';
import { useActiveProducts } from '../hooks/use-active-products';
import { useArchivedProducts } from '../hooks/use-archived-products';

/** Props of {@link ProductsScreen}. */
export interface ProductsScreenProps {
  readonly onAddProduct: () => void;
  readonly onOpenProduct: (id: ProductId) => void;
  readonly onOpenArchived: () => void;
}

/**
 * Products tab (design 3.1 and 4.1): the active products in alphabetical order, the fixed
 * "Agregar producto" button and, only when there are archived ones, "Ver archivados (n)".
 * The archived count is a hint: while it loads or fails the link just does not appear.
 */
export function ProductsScreen({
  onAddProduct,
  onOpenProduct,
  onOpenArchived,
}: ProductsScreenProps) {
  const active = useActiveProducts();
  const archived = useArchivedProducts();
  const archivedCount = archived.data?.length ?? 0;

  return (
    <Screen>
      <ScreenHeader title="Productos" />
      <View className="flex-1">
        {active.isPending ? (
          <LoadingState label="Cargando productos" shape="rows" count={4} />
        ) : active.isError ? (
          <ErrorState
            message="No se pudieron cargar tus productos. Inténtalo de nuevo."
            onRetry={() => {
              void active.refetch();
            }}
          />
        ) : active.data.length === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title={
              archivedCount > 0 ? 'No tienes productos en tu lista' : 'Aquí vas a ver tus productos'
            }
            description={
              archivedCount > 0
                ? 'Los que archivaste siguen guardados.'
                : 'Agrega lo que vendes con su precio y registrar tus ventas será más rápido.'
            }
            primaryAction={{ label: 'Agregar producto', onPress: onAddProduct }}
            secondaryAction={
              archivedCount > 0 ? { label: 'Ver archivados', onPress: onOpenArchived } : undefined
            }
          />
        ) : (
          <>
            <ProductList
              products={active.data}
              onOpenProduct={onOpenProduct}
              footer={
                archivedCount > 0 ? (
                  <View className="items-center pt-4">
                    <TextButton
                      label={`Ver archivados (${String(archivedCount)})`}
                      onPress={onOpenArchived}
                    />
                  </View>
                ) : undefined
              }
            />
            <View className="px-4 pb-4">
              <PrimaryButton label="Agregar producto" icon={PlusIcon} onPress={onAddProduct} />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}
