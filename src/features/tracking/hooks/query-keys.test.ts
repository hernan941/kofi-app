import { rootKeysToInvalidate } from '@/core/providers/query/root-keys-to-invalidate';
import { localDateSchema, productVersionIdSchema } from '@/shared/domain';

import { TRACKING_QUERY_DEPENDENCIES, trackingCostKeys, trackingKeys } from './query-keys';

const version = (n: number) =>
  productVersionIdSchema.parse(`22222222-2222-7222-8222-${String(n).padStart(12, '0')}`);

describe('tracking query keys', () => {
  it('puts the range inside the sales key', () => {
    expect(
      trackingKeys.salesBetween(
        localDateSchema.parse('2026-06-01'),
        localDateSchema.parse('2026-07-01'),
      ),
    ).toEqual(['tracking', 'sales-between', '2026-06-01', '2026-07-01']);
  });

  it('puts the range of the grid inside the calendar key and the Monday inside the week key', () => {
    expect(
      trackingKeys.calendar(
        localDateSchema.parse('2026-10-26'),
        localDateSchema.parse('2026-12-06'),
      ),
    ).toEqual(['tracking', 'calendar', '2026-10-26', '2026-12-06']);
    expect(trackingKeys.weekFacts(localDateSchema.parse('2026-11-09'))).toEqual([
      'tracking',
      'week-facts',
      '2026-11-09',
    ]);
  });

  it('changes the costs key with the set of versions', () => {
    expect(trackingCostKeys.forVersions([version(1)])).not.toEqual(
      trackingCostKeys.forVersions([version(1), version(2)]),
    );
  });

  it('reloads only the sales when a sale is saved', () => {
    expect(
      rootKeysToInvalidate(TRACKING_QUERY_DEPENDENCIES, new Set(['sale_records', 'sale_items'])),
    ).toEqual([['tracking']]);
  });

  it('reloads only the costs when a cost changes', () => {
    expect(
      rootKeysToInvalidate(TRACKING_QUERY_DEPENDENCIES, new Set(['product_versions'])),
    ).toEqual([['tracking-costs']]);
  });

  it('ignores the views of a tip', () => {
    expect(rootKeysToInvalidate(TRACKING_QUERY_DEPENDENCIES, new Set(['tip_views']))).toEqual([]);
  });
});
