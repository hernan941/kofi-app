import { rootKeysToInvalidate } from '@/core/providers/query/root-keys-to-invalidate';
import { QUERY_DEPENDENCIES } from '@/core/providers/query/query-dependencies';
import type { TableName } from '@/core/db/table-names';

import type { ProductId } from '@/shared/domain';

import { PRODUCT_ID, fixtureId } from '../domain/testing/product-fixtures';
import { PRODUCTS_QUERY_DEPENDENCIES, productKeys, productVersionUsageKeys } from './query-keys';

const roots = (tables: TableName[]) =>
  rootKeysToInvalidate(PRODUCTS_QUERY_DEPENDENCIES, new Set(tables));

describe('query keys', () => {
  it('nests every product key under the products root', () => {
    expect(productKeys.all).toEqual(['products']);
    expect(productKeys.active()).toEqual(['products', 'active']);
    expect(productKeys.archived()).toEqual(['products', 'archived']);
    expect(productKeys.detail(PRODUCT_ID)).toEqual(['products', 'detail', PRODUCT_ID]);
  });

  it('builds the by-ids key under the products root with the ids sorted', () => {
    const other = fixtureId(2) as ProductId;

    expect(productKeys.byIds([other, PRODUCT_ID])).toEqual([
      'products',
      'by-ids',
      ...[PRODUCT_ID, other].sort(),
    ]);
    expect(productKeys.byIds([PRODUCT_ID, other])).toEqual(productKeys.byIds([other, PRODUCT_ID]));
  });

  it('does not repeat an id in the by-ids key', () => {
    expect(productKeys.byIds([PRODUCT_ID, PRODUCT_ID])).toEqual(['products', 'by-ids', PRODUCT_ID]);
  });

  it('nests the version usage keys under their own root', () => {
    expect(productVersionUsageKeys.all).toEqual(['product-version-usage']);
    expect(productVersionUsageKeys.withSales(PRODUCT_ID)).toEqual([
      'product-version-usage',
      PRODUCT_ID,
    ]);
  });

  it('reloads products when product tables change but not when a sale is saved', () => {
    expect(roots(['products'])).toEqual([['products']]);
    expect(roots(['product_photos'])).toEqual([['products']]);
    expect(roots(['sale_items'])).toEqual([['product-version-usage']]);
    expect(roots(['sale_records'])).toEqual([['product-version-usage']]);
  });

  it('reloads both roots when versions change', () => {
    expect(roots(['product_versions'])).toEqual([['products'], ['product-version-usage']]);
  });

  it('is part of the app registry', () => {
    expect(QUERY_DEPENDENCIES).toEqual(expect.arrayContaining([...PRODUCTS_QUERY_DEPENDENCIES]));
  });
});
