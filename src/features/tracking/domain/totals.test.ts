import { MAX_SALE_TOTAL } from '@/features/sales/domain';

import { compareTotals, recordsBetween, totalBetween } from './totals';
import { clp, day, item, record, saleOf } from './testing/tracking-fixtures';

const range = (start: string, end: string) => ({ start: day(start), end: day(end) });

describe('recordsBetween', () => {
  test('keeps only records inside the closed range', () => {
    const inside = saleOf('2026-11-10', 1000);
    const records = [saleOf('2026-11-08', 1), inside, saleOf('2026-11-16', 1)];
    expect(recordsBetween(records, range('2026-11-09', '2026-11-15'))).toEqual([inside]);
  });
});

describe('totalBetween', () => {
  test('adds a week that crosses two months', () => {
    const records = [
      saleOf('2026-10-29', 1000),
      saleOf('2026-11-01', 2000),
      saleOf('2026-11-02', 5000),
    ];
    expect(totalBetween(records, range('2026-10-26', '2026-11-01'))).toBe(3000);
  });

  test('counts Sunday sales in their own week and not in the next one', () => {
    const sunday = saleOf('2026-11-15', 4000);
    expect(totalBetween([sunday], range('2026-11-09', '2026-11-15'))).toBe(4000);
    expect(totalBetween([sunday], range('2026-11-16', '2026-11-22'))).toBe(0);
  });

  test('a record without items adds zero', () => {
    expect(totalBetween([record('2026-11-10', [])], range('2026-11-09', '2026-11-15'))).toBe(0);
  });

  test('multiplies quantity by price', () => {
    const sale = record('2026-11-10', [item({ quantity: 3, unitPrice: clp(1500) })]);
    expect(totalBetween([sale], range('2026-11-09', '2026-11-15'))).toBe(4500);
  });

  test('saturates at the maximum representable amount', () => {
    const records = [saleOf('2026-11-10', MAX_SALE_TOTAL), saleOf('2026-11-11', 1000)];
    expect(totalBetween(records, range('2026-11-09', '2026-11-15'))).toBe(MAX_SALE_TOTAL);
  });
});

describe('compareTotals', () => {
  test('goes up with difference and rounded percent', () => {
    expect(compareTotals(clp(12_000), clp(8000))).toEqual({
      kind: 'up',
      difference: 4000,
      percent: 50,
    });
    expect(compareTotals(clp(1000), clp(3000))).toEqual({
      kind: 'down',
      difference: 2000,
      percent: 67,
    });
  });

  test('is the same when the amounts are equal', () => {
    expect(compareTotals(clp(5000), clp(5000))).toEqual({ kind: 'same' });
  });

  test('is first when the previous period is zero and the current is not', () => {
    expect(compareTotals(clp(5000), clp(0))).toEqual({ kind: 'first' });
  });

  test('is no data when both are zero', () => {
    expect(compareTotals(clp(0), clp(0))).toEqual({ kind: 'no_data' });
  });

  test('drops by 100 percent when the current is zero and the previous is not', () => {
    expect(compareTotals(clp(0), clp(2500))).toEqual({
      kind: 'down',
      difference: 2500,
      percent: 100,
    });
  });

  test('rounds the percent to the nearest integer', () => {
    expect(compareTotals(clp(1005), clp(1000))).toEqual({
      kind: 'up',
      difference: 5,
      percent: 1,
    });
  });
});
