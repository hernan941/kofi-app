import { homeRanges } from './periods';
import { homeSummary } from './home-summary';
import { day, saleOf } from './testing/tracking-fixtures';

describe('homeSummary', () => {
  const today = day('2026-11-12');
  const ranges = homeRanges(today);

  test('totals and compares the week and the month with their equivalent segments', () => {
    const records = [
      saleOf('2026-11-09', 3000),
      saleOf('2026-11-12', 1000),
      saleOf('2026-11-03', 6000),
      saleOf('2026-11-04', 2000),
      saleOf('2026-10-05', 4000),
      saleOf('2026-10-20', 9999),
    ];
    const summary = homeSummary(records, ranges);
    expect(summary.week.total).toBe(4000);
    expect(summary.week.previousTotal).toBe(8000);
    expect(summary.week.comparison).toEqual({ kind: 'down', difference: 4000, percent: 50 });
    expect(summary.month.total).toBe(12_000);
    expect(summary.month.previousTotal).toBe(4000);
    expect(summary.month.comparison).toEqual({ kind: 'up', difference: 8000, percent: 200 });
  });

  test('returns the month records up to today for the profit', () => {
    const inMonth = saleOf('2026-11-02', 1000);
    const summary = homeSummary([inMonth, saleOf('2026-10-02', 1000)], ranges);
    expect(summary.monthRecords).toEqual([inMonth]);
  });

  test('without sales everything is zero and there is no data', () => {
    const summary = homeSummary([], ranges);
    expect(summary.week.comparison).toEqual({ kind: 'no_data' });
    expect(summary.month.total).toBe(0);
    expect(summary.monthRecords).toEqual([]);
  });
});
