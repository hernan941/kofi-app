import { localDateSchema } from './local-date';
import {
  addMonths,
  compareYearMonth,
  monthRangeOf,
  yearMonthOf,
  yearMonthSchema,
} from './year-month';

const month = (value: string) => yearMonthSchema.parse(value);

describe('yearMonthSchema', () => {
  test.each(['2026-01', '2026-12', '0001-06'])('accepts %s', (value) => {
    expect(yearMonthSchema.safeParse(value).success).toBe(true);
  });

  test.each(['2026-13', '2026-1', '26-01', '2026-00', '2026-01-01', ''])('rejects %s', (value) => {
    expect(yearMonthSchema.safeParse(value).success).toBe(false);
  });
});

describe('yearMonthOf', () => {
  test('returns the month of the last day of the year', () => {
    expect(yearMonthOf(localDateSchema.parse('2026-12-31'))).toBe('2026-12');
  });

  test('returns the month of the first day of a month', () => {
    expect(yearMonthOf(localDateSchema.parse('2027-01-01'))).toBe('2027-01');
  });
});

describe('addMonths', () => {
  test('crosses the year forward and backward', () => {
    expect(addMonths(month('2026-12'), 1)).toBe('2027-01');
    expect(addMonths(month('2026-01'), -1)).toBe('2025-12');
  });

  test('adds whole years', () => {
    expect(addMonths(month('2026-05'), 24)).toBe('2028-05');
    expect(addMonths(month('2026-05'), -24)).toBe('2024-05');
  });

  test('adds zero months', () => {
    expect(addMonths(month('2026-05'), 0)).toBe('2026-05');
  });

  test('handles a large negative jump', () => {
    expect(addMonths(month('2026-03'), -14)).toBe('2025-01');
  });
});

describe('monthRangeOf', () => {
  test('covers a leap February', () => {
    expect(monthRangeOf(month('2028-02'))).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  test('covers a non-leap February', () => {
    expect(monthRangeOf(month('2027-02'))).toEqual({ start: '2027-02-01', end: '2027-02-28' });
  });

  test('covers a 31-day month', () => {
    expect(monthRangeOf(month('2026-12'))).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});

describe('compareYearMonth', () => {
  test('orders months like a sort comparator', () => {
    expect(compareYearMonth(month('2026-01'), month('2026-02'))).toBeLessThan(0);
    expect(compareYearMonth(month('2027-01'), month('2026-12'))).toBeGreaterThan(0);
    expect(compareYearMonth(month('2026-05'), month('2026-05'))).toBe(0);
  });
});
