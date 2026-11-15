import type { Clp } from '@/shared/domain';
import { ListRow } from '@/shared/ui';

import { activeVersions, type Product, type ProductVersion } from '../domain';
import { ProductThumbnail, coverPhotoIdOf } from './product-thumbnail';

/** Props of {@link ProductListItem}. */
export interface ProductListItemProps {
  readonly product: Product;
  readonly onPress: () => void;
  /** UX-F7: the list draws a 40 × 40 cover (or a neutral box) only if some product has a cover. */
  readonly showThumbnail?: boolean;
}

/** Fixed prices of the versions. */
function fixedPrices(versions: readonly ProductVersion[]): readonly Clp[] {
  return versions.flatMap((version) =>
    version.pricing.mode === 'fixed' ? [version.pricing.price] : [],
  );
}

/** Lowest of the prices, or `undefined` when there is none. */
function lowestPrice(prices: readonly Clp[]): Clp | undefined {
  return prices.reduce<Clp | undefined>(
    (lowest, price) => (lowest === undefined || price < lowest ? price : lowest),
    undefined,
  );
}

/** Row of the products list (design 3.1): one number per row, "desde" for several versions. */
export function ProductListItem({ product, onPress, showThumbnail = false }: ProductListItemProps) {
  const versions = activeVersions(product);
  const prices = fixedPrices(versions);
  const lowest = lowestPrice(prices);
  const leading = showThumbnail ? (
    <ProductThumbnail coverPhotoId={coverPhotoIdOf(product)} />
  ) : undefined;

  if (versions.length === 0) {
    return (
      <ListRow
        title={product.name}
        subtitle="Sin precio por ahora"
        accessibilityLabel={`${product.name}, sin precio por ahora`}
        leading={leading}
        onPress={onPress}
      />
    );
  }
  if (versions.length === 1) {
    return lowest === undefined ? (
      <ListRow
        title={product.name}
        subtitle="A convenir"
        accessibilityLabel={`${product.name}, precio a convenir`}
        leading={leading}
        onPress={onPress}
      />
    ) : (
      <ListRow title={product.name} amount={lowest} leading={leading} onPress={onPress} />
    );
  }
  const count = `${String(versions.length)} versiones`;
  return lowest === undefined ? (
    <ListRow
      title={product.name}
      subtitle={`${count} · a convenir`}
      accessibilityLabel={`${product.name}, ${count}, precio a convenir`}
      onPress={onPress}
    />
  ) : (
    <ListRow
      title={product.name}
      subtitle={count}
      amount={lowest}
      amountPrefix="desde"
      leading={leading}
      onPress={onPress}
    />
  );
}
