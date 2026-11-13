import type { Clp } from '@/shared/domain';
import { ListRow } from '@/shared/ui';

import { activeVersions, type Product, type ProductVersion } from '../domain';

/** Props of {@link ProductListItem}. */
export interface ProductListItemProps {
  readonly product: Product;
  readonly onPress: () => void;
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
export function ProductListItem({ product, onPress }: ProductListItemProps) {
  const versions = activeVersions(product);
  const prices = fixedPrices(versions);
  const lowest = lowestPrice(prices);

  if (versions.length === 0) {
    return (
      <ListRow
        title={product.name}
        subtitle="Sin precio por ahora"
        accessibilityLabel={`${product.name}, sin precio por ahora`}
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
        onPress={onPress}
      />
    ) : (
      <ListRow title={product.name} amount={lowest} onPress={onPress} />
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
      onPress={onPress}
    />
  );
}
