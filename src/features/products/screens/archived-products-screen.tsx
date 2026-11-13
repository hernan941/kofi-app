import { Text, View } from 'react-native';

import type { ProductId } from '@/shared/domain';
import {
  ArchiveIcon,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
} from '@/shared/ui';

import { ProductList } from '../components/product-list';
import { useArchivedProducts } from '../hooks/use-archived-products';

/** Props of {@link ArchivedProductsScreen}. */
export interface ArchivedProductsScreenProps {
  readonly onBack: () => void;
  readonly onOpenProduct: (id: ProductId) => void;
}

/** Archived products (design 3.2 and 4.2): consultation only; "Volver a usar" lives in the detail. */
export function ArchivedProductsScreen({ onBack, onOpenProduct }: ArchivedProductsScreenProps) {
  const archived = useArchivedProducts();
  return (
    <Screen>
      <ScreenHeader title="Archivados" onBack={onBack} />
      <View className="flex-1">
        {archived.isPending ? (
          <LoadingState label="Cargando archivados" shape="rows" count={3} />
        ) : archived.isError ? (
          <ErrorState
            message="No se pudieron cargar tus archivados. Inténtalo de nuevo."
            onRetry={() => {
              void archived.refetch();
            }}
          />
        ) : archived.data.length === 0 ? (
          <EmptyState
            icon={ArchiveIcon}
            title="No tienes productos archivados"
            description="Cuando archives un producto, lo encuentras aquí."
          />
        ) : (
          <ProductList
            products={archived.data}
            onOpenProduct={onOpenProduct}
            header={
              <Text className="pb-4 text-base text-muted">
                Aquí guardas lo que ya no vendes. Tus ventas pasadas no cambian y puedes volver a
                usar cualquiera.
              </Text>
            }
          />
        )}
      </View>
    </Screen>
  );
}
