import { yearMonthSchema } from '@/shared/domain';

import { monthNavigation, monthlySummary, resolveMonth } from './monthly-summary';
import { clp, day, item, productId, record, saleOf } from './testing/tracking-fixtures';

const month = (value: string) => yearMonthSchema.parse(value);
const NOVEMBER = month('2026-11');

describe('monthlySummary', () => {
  test('a month without sales has zero totals and empty lists', () => {
    expect(monthlySummary([], NOVEMBER)).toEqual({
      month: NOVEMBER,
      total: 0,
      recordCount: 0,
      topProducts: [],
      topChannels: [],
    });
  });

  test('ignores records outside the month', () => {
    const summary = monthlySummary(
      [saleOf('2026-10-31', 500), saleOf('2026-11-01', 1000), saleOf('2026-12-01', 700)],
      NOVEMBER,
    );
    expect(summary.total).toBe(1000);
    expect(summary.recordCount).toBe(1);
  });

  test('does not count records without items', () => {
    const summary = monthlySummary([record('2026-11-05', [])], NOVEMBER);
    expect(summary.recordCount).toBe(0);
    expect(summary.topChannels).toEqual([]);
  });

  test('the top product is the one with the most revenue, not the most units', () => {
    const cheapMany = item({ productId: productId(1), quantity: 10, unitPrice: clp(100) });
    const expensiveFew = item({ productId: productId(2), quantity: 1, unitPrice: clp(5000) });
    const summary = monthlySummary([record('2026-11-05', [cheapMany, expensiveFew])], NOVEMBER);
    expect(summary.topProducts).toEqual([{ productId: productId(2), revenue: 5000 }]);
  });

  test('adds a product across records', () => {
    const summary = monthlySummary(
      [
        record('2026-11-05', [item({ productId: productId(1), unitPrice: clp(1000) })]),
        record('2026-11-06', [item({ productId: productId(1), unitPrice: clp(1000) })]),
        record('2026-11-07', [item({ productId: productId(2), unitPrice: clp(1500) })]),
      ],
      NOVEMBER,
    );
    expect(summary.topProducts).toEqual([{ productId: productId(1), revenue: 2000 }]);
  });

  test('returns every tied product ordered by id', () => {
    const summary = monthlySummary(
      [
        record('2026-11-05', [
          item({ productId: productId(2), unitPrice: clp(3000) }),
          item({ productId: productId(1), unitPrice: clp(3000) }),
        ]),
      ],
      NOVEMBER,
    );
    expect(summary.topProducts.map((entry) => entry.productId)).toEqual([
      productId(1),
      productId(2),
    ]);
  });

  test('has no top product when the maximum revenue is zero', () => {
    const summary = monthlySummary([saleOf('2026-11-05', 0)], NOVEMBER);
    expect(summary.topProducts).toEqual([]);
    expect(summary.recordCount).toBe(1);
  });

  test('records without channel do not compete for the top channel', () => {
    const summary = monthlySummary(
      [
        saleOf('2026-11-05', 9000),
        saleOf('2026-11-06', 1000, { channel: 'fair' }),
        saleOf('2026-11-07', 500, { channel: 'social_media' }),
      ],
      NOVEMBER,
    );
    expect(summary.topChannels).toEqual([{ channel: 'fair', revenue: 1000 }]);
  });

  test('has no top channel when no sale has a channel', () => {
    expect(monthlySummary([saleOf('2026-11-05', 9000)], NOVEMBER).topChannels).toEqual([]);
  });

  test('returns tied channels in the canonical channel order', () => {
    const summary = monthlySummary(
      [
        saleOf('2026-11-05', 1000, { channel: 'other' }),
        saleOf('2026-11-06', 1000, { channel: 'fair' }),
      ],
      NOVEMBER,
    );
    expect(summary.topChannels.map((entry) => entry.channel)).toEqual(['fair', 'other']);
  });
});

describe('monthNavigation', () => {
  const current = month('2026-11');

  test('the current month has no next month', () => {
    expect(monthNavigation(current, current, month('2026-01')).canGoForward).toBe(false);
    expect(monthNavigation(month('2026-10'), current, month('2026-01')).canGoForward).toBe(true);
  });

  test('the earliest month with sales has no previous month', () => {
    expect(monthNavigation(month('2026-01'), current, month('2026-01')).canGoBack).toBe(false);
    expect(monthNavigation(month('2026-02'), current, month('2026-01')).canGoBack).toBe(true);
  });

  test('without sales there is no previous month', () => {
    expect(monthNavigation(current, current, null).canGoBack).toBe(false);
  });
});

describe('resolveMonth', () => {
  const today = day('2026-11-12');

  test('null resolves to the current month', () => {
    expect(resolveMonth(null, today)).toBe('2026-11');
  });

  test('a future month resolves to the current month', () => {
    expect(resolveMonth(month('2027-01'), today)).toBe('2026-11');
  });

  test('a past or current month is kept', () => {
    expect(resolveMonth(month('2026-03'), today)).toBe('2026-03');
    expect(resolveMonth(month('2026-11'), today)).toBe('2026-11');
  });
});
