import type { QueryDependency } from './root-keys-to-invalidate';
import { rootKeysToInvalidate } from './root-keys-to-invalidate';

const DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['products'], tables: new Set(['products', 'product_versions']) },
  { rootKey: ['sales'], tables: new Set(['sale_records', 'sale_items', 'product_versions']) },
  { rootKey: ['tips'], tables: new Set(['tip_views']) },
];

describe('rootKeysToInvalidate', () => {
  test('returns nothing for tables nobody depends on', () => {
    expect(rootKeysToInvalidate(DEPENDENCIES, new Set(['notification_preferences']))).toEqual([]);
  });

  test('returns every root that depends on the same table', () => {
    expect(rootKeysToInvalidate(DEPENDENCIES, new Set(['product_versions']))).toEqual([
      ['products'],
      ['sales'],
    ]);
  });

  test('returns each root once when several changed tables match it', () => {
    expect(
      rootKeysToInvalidate(DEPENDENCIES, new Set(['sale_records', 'sale_items', 'tip_views'])),
    ).toEqual([['sales'], ['tips']]);
  });

  test('returns nothing for an empty set of tables', () => {
    expect(rootKeysToInvalidate(DEPENDENCIES, new Set())).toEqual([]);
  });

  test('returns nothing when no dependencies are registered', () => {
    expect(rootKeysToInvalidate([], new Set(['products']))).toEqual([]);
  });
});
