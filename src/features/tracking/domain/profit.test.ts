import type { Clp, ProductVersionId } from '@/shared/domain';

import { approximateProfit, profitCoverage, versionIdsNeedingCurrentCost } from './profit';
import { clp, item, record, versionId } from './testing/tracking-fixtures';

type CostMap = ReadonlyMap<ProductVersionId, Clp | null>;
const NO_COSTS: CostMap = new Map();

describe('approximateProfit', () => {
  test('returns null when no item has a cost', () => {
    expect(approximateProfit([record('2026-11-05')], NO_COSTS)).toBeNull();
  });

  test('returns null for no records', () => {
    expect(approximateProfit([], NO_COSTS)).toBeNull();
  });

  test('returns null when the map only has null costs', () => {
    const costs: CostMap = new Map([[versionId(1), null]]);
    expect(approximateProfit([record('2026-11-05')], costs)).toBeNull();
  });

  test('with every cost known returns the full profit', () => {
    const sale = record('2026-11-05', [
      item({ quantity: 2, unitPrice: clp(1000), unitCost: clp(300) }),
      item({ unitPrice: clp(500), unitCost: clp(100) }),
    ]);
    const summary = approximateProfit([sale], NO_COSTS);
    expect(summary).toEqual({ profit: 1800, revenueWithCost: 2500, revenueTotal: 2500 });
    expect(summary && profitCoverage(summary)).toBe('full');
  });

  test('with partial coverage only counts the items that have a cost', () => {
    const sale = record('2026-11-05', [
      item({ unitPrice: clp(1000), unitCost: clp(400) }),
      item({ productVersionId: versionId(2), unitPrice: clp(3000), unitCost: null }),
    ]);
    const summary = approximateProfit([sale], NO_COSTS);
    expect(summary).toEqual({ profit: 600, revenueWithCost: 1000, revenueTotal: 4000 });
    expect(summary && profitCoverage(summary)).toBe('partial');
  });

  test('an item without unitCost takes the current cost from the map', () => {
    const sale = record('2026-11-05', [item({ unitPrice: clp(1000), unitCost: null })]);
    const costs: CostMap = new Map([[versionId(1), clp(250)]]);
    expect(approximateProfit([sale], costs)?.profit).toBe(750);
  });

  test('an item with unitCost keeps it even if the map says otherwise', () => {
    const sale = record('2026-11-05', [item({ unitPrice: clp(1000), unitCost: clp(200) })]);
    const costs: CostMap = new Map([[versionId(1), clp(900)]]);
    expect(approximateProfit([sale], costs)?.profit).toBe(800);
  });

  test('a price below the cost gives a negative profit', () => {
    const sale = record('2026-11-05', [item({ unitPrice: clp(1000), unitCost: clp(1500) })]);
    expect(approximateProfit([sale], NO_COSTS)?.profit).toBe(-500);
  });

  test('a cost of zero counts as a loaded cost', () => {
    const sale = record('2026-11-05', [item({ unitPrice: clp(1000), unitCost: clp(0) })]);
    expect(approximateProfit([sale], NO_COSTS)).toEqual({
      profit: 1000,
      revenueWithCost: 1000,
      revenueTotal: 1000,
    });
  });

  test('a record without items does not affect the result', () => {
    const sale = record('2026-11-05', [item({ unitPrice: clp(1000), unitCost: clp(400) })]);
    expect(approximateProfit([record('2026-11-06', []), sale], NO_COSTS)?.profit).toBe(600);
  });

  test('a version missing from the map counts as no cost', () => {
    const sale = record('2026-11-05', [item({ productVersionId: versionId(9), unitCost: null })]);
    const costs: CostMap = new Map([[versionId(1), clp(100)]]);
    expect(approximateProfit([sale], costs)).toBeNull();
  });

  test('saturates profit and revenue at the representable limits', () => {
    const big = (cost: number) =>
      record('2026-11-05', [
        item({ quantity: 9999, unitPrice: clp(999_999), unitCost: clp(cost) }),
      ]);
    const gain = approximateProfit([big(0), big(0)], NO_COSTS);
    expect(gain).toEqual({
      profit: 999_999_999,
      revenueWithCost: 999_999_999,
      revenueTotal: 999_999_999,
    });
    const loss = approximateProfit(
      [
        record('2026-11-05', [
          item({ quantity: 9999, unitPrice: clp(0), unitCost: clp(999_999) }),
          item({ quantity: 9999, unitPrice: clp(0), unitCost: clp(999_999) }),
        ]),
      ],
      NO_COSTS,
    );
    expect(loss?.profit).toBe(-999_999_999);
  });
});

describe('versionIdsNeedingCurrentCost', () => {
  test('excludes items with a copied cost, removes duplicates and sorts', () => {
    const sale = record('2026-11-05', [
      item({ productVersionId: versionId(3), unitCost: null }),
      item({ productVersionId: versionId(2), unitCost: clp(100) }),
      item({ productVersionId: versionId(1), unitCost: null }),
      item({ productVersionId: versionId(3), unitCost: null }),
    ]);
    expect(versionIdsNeedingCurrentCost([sale, record('2026-11-06', [])])).toEqual([
      versionId(1),
      versionId(3),
    ]);
  });

  test('a cost of zero is a copied cost', () => {
    const sale = record('2026-11-05', [item({ unitCost: clp(0) })]);
    expect(versionIdsNeedingCurrentCost([sale])).toEqual([]);
  });
});
