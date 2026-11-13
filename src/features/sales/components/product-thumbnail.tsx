import { View } from 'react-native';

import { ProductPhoto } from '@/features/products';
import { coverPhoto, type Product } from '@/features/products/domain';
import type { ProductPhotoId } from '@/shared/domain';
import { Icon, PackageIcon } from '@/shared/ui';

/** Id de la portada de un producto (D-17), o `null` si no tiene fotos. */
export function coverPhotoIdOf(product: Product | null): ProductPhotoId | null {
  return product === null ? null : (coverPhoto(product)?.id ?? null);
}

/** UX-F7: la columna de miniaturas solo aparece si algún producto de la lista tiene portada. */
export function anyProductHasCover(products: readonly Product[]): boolean {
  return products.some((product) => coverPhoto(product) !== null);
}

/** Props of {@link ProductThumbnail}. */
export interface ProductThumbnailProps {
  readonly coverPhotoId: ProductPhotoId | null;
}

const BOX_CLASSES = 'size-10 rounded-xl border-2 border-field-border';

/**
 * Miniatura de 40 × 40 de la portada del producto (`coverPhoto`, D-17), o el recuadro neutro
 * con el ícono `Package` si no tiene foto. Es decorativa: la fila ya se lee con el nombre.
 */
export function ProductThumbnail({ coverPhotoId }: ProductThumbnailProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="size-10"
    >
      {coverPhotoId === null ? (
        <View className={`bg-field-background items-center justify-center ${BOX_CLASSES}`}>
          <Icon icon={PackageIcon} size="md" color="muted" />
        </View>
      ) : (
        <ProductPhoto
          photoId={coverPhotoId}
          label="Foto del producto"
          className={BOX_CLASSES}
          placeholderIconSize="md"
        />
      )}
    </View>
  );
}
