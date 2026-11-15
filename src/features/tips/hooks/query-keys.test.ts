import { rootKeysToInvalidate } from '@/core/providers/query/root-keys-to-invalidate';
import { saleRecordIdSchema } from '@/shared/domain';

import { TIPS_QUERY_DEPENDENCIES, tipAfterSaleKeys, tipKeys } from './query-keys';

const recordId = saleRecordIdSchema.parse('44444444-4444-7444-8444-000000000001');

describe('tips query keys', () => {
  it('nests the views key under the tips root', () => {
    expect(tipKeys.views().slice(0, 1)).toEqual(tipKeys.all);
  });

  it('freezes the after-sale choice per record', () => {
    expect(tipAfterSaleKeys.forRecord(recordId)).toEqual(['tip-after-sale', recordId]);
  });

  it('reloads the tips root, and only it, when tip_views changes', () => {
    expect(rootKeysToInvalidate(TIPS_QUERY_DEPENDENCIES, new Set(['tip_views']))).toEqual([
      ['tips'],
    ]);
  });

  it('never invalidates the after-sale choice, whatever the table', () => {
    const everyTable = new Set([
      'tip_views',
      'sale_records',
      'sale_items',
      'products',
      'product_versions',
      'no_sales_weeks',
    ] as const);

    expect(rootKeysToInvalidate(TIPS_QUERY_DEPENDENCIES, everyTable)).not.toContainEqual([
      'tip-after-sale',
    ]);
  });
});
