import { useCallback, type ReactElement } from 'react';
import { FlatList, View, type ListRenderItemInfo } from 'react-native';

import type { ProductId } from '@/shared/domain';
import { ListSeparator } from '@/shared/ui';

import type { Product } from '../domain';
import { ProductListItem } from './product-list-item';

/** Props of {@link ProductList}. */
export interface ProductListProps {
  readonly products: readonly Product[];
  readonly onOpenProduct: (id: ProductId) => void;
  readonly header?: ReactElement;
  readonly footer?: ReactElement;
}

const SIDE_CLASSES = 'border-x-2 border-border bg-surface px-4';

/** Classes that round the first and last row so all of them look like one card. */
function rowClasses(isFirst: boolean, isLast: boolean): string {
  return [
    SIDE_CLASSES,
    isFirst ? 'rounded-t-3xl border-t-2' : '',
    isLast ? 'rounded-b-3xl border-b-2' : '',
  ].join(' ');
}

/** Stable key of a row. */
function keyOf(product: Product): string {
  return product.id;
}

/** Separator between rows, inside the card. */
function RowSeparator() {
  return (
    <View className={SIDE_CLASSES}>
      <ListSeparator />
    </View>
  );
}

/**
 * Products list (design 3.1) in a `FlatList`: the rows look like one card, in the order the
 * hook gives (it does not sort). Used by the list tab and by the archived products.
 */
export function ProductList({ products, onOpenProduct, header, footer }: ProductListProps) {
  const lastIndex = products.length - 1;
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Product>) => (
      <View className={rowClasses(index === 0, index === lastIndex)}>
        <ProductListItem
          product={item}
          onPress={() => {
            onOpenProduct(item.id);
          }}
        />
      </View>
    ),
    [lastIndex, onOpenProduct],
  );
  return (
    <FlatList
      data={products}
      keyExtractor={keyOf}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ItemSeparatorComponent={RowSeparator}
      contentContainerClassName="gap-0 px-4 pb-6"
      renderItem={renderItem}
    />
  );
}
