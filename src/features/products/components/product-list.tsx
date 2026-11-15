import { useCallback, type ReactElement } from 'react';
import { FlatList, type ListRenderItemInfo } from 'react-native';

import type { ProductId } from '@/shared/domain';
import { CardListItem, CardListSeparator } from '@/shared/ui';

import type { Product } from '../domain';
import { ProductListItem } from './product-list-item';
import { anyProductHasCover } from './product-thumbnail';

/** Props of {@link ProductList}. */
export interface ProductListProps {
  readonly products: readonly Product[];
  readonly onOpenProduct: (id: ProductId) => void;
  readonly header?: ReactElement;
  readonly footer?: ReactElement;
}

/** Stable key of a row. */
function keyOf(product: Product): string {
  return product.id;
}

/**
 * Products list (design 3.1) in a `FlatList`: the rows look like one card, in the order the
 * hook gives (it does not sort). Thumbnails (UX-F7) appear only if some product has a cover. Used by the list tab and by the archived products.
 */
export function ProductList({ products, onOpenProduct, header, footer }: ProductListProps) {
  const lastIndex = products.length - 1;
  const showThumbnails = anyProductHasCover(products);
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Product>) => (
      <CardListItem isFirst={index === 0} isLast={index === lastIndex}>
        <ProductListItem
          product={item}
          showThumbnail={showThumbnails}
          onPress={() => {
            onOpenProduct(item.id);
          }}
        />
      </CardListItem>
    ),
    [lastIndex, onOpenProduct, showThumbnails],
  );
  return (
    <FlatList
      data={products}
      keyExtractor={keyOf}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ItemSeparatorComponent={CardListSeparator}
      contentContainerClassName="gap-0 px-4 pb-6"
      renderItem={renderItem}
    />
  );
}
