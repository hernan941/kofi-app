import {
  addDays,
  daysBetween,
  isAfter,
  isoWeekday,
  isoWeekStart,
  localDateFromParts,
  localDateParts,
  monthRange,
} from './arithmetic';
import { localDateSchema, type LocalDate } from './local-date';

const date = (value: string): LocalDate => localDateSchema.parse(value);

describe('localDateFromParts and localDateParts', () => {
  test('round trip', () => {
    const value = localDateFromParts(2026, 3, 9);

    expect(value).toBe('2026-03-09');
    expect(localDateParts(value)).toEqual({ year: 2026, month: 3, day: 9 });
  });

  test('rejects parts that are not a real date', () => {
    expect(() => localDateFromParts(2026, 2, 30)).toThrow();
  });
});

describe('addDays', () => {
  test.each([
    ['2026-11-13', 1, '2026-11-14'],
    ['2026-11-13', 0, '2026-11-13'],
    ['2026-11-30', 1, '2026-12-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2028-02-29', 1, '2028-03-01'],
    ['2027-02-28', 1, '2027-03-01'],
    ['2026-01-01', 365, '2027-01-01'],
    ['2028-01-01', 366, '2029-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-09-06', 7, '2026-09-13'],
  ])('addDays(%s, %i) = %s', (start, days, expected) => {
    expect(addDays(date(start), days)).toBe(expected);
  });

  test('is reversible for many offsets', () => {
    const start = date('2026-11-13');

    for (let days = -800; days <= 800; days += 37) {
      expect(addDays(addDays(start, days), -days)).toBe(start);
    }
  });
});

describe('daysBetween', () => {
  test.each([
    ['2026-11-13', '2026-11-13', 0],
    ['2026-11-13', '2026-11-14', 1],
    ['2026-11-14', '2026-11-13', -1],
    ['2026-12-31', '2027-01-01', 1],
    ['2028-02-28', '2028-03-01', 2],
    ['2027-02-28', '2027-03-01', 1],
    ['2026-01-01', '2027-01-01', 365],
  ])('daysBetween(%s, %s) = %i', (from, to, expected) => {
    expect(daysBetween(date(from), date(to))).toBe(expected);
  });

  test('is consistent with addDays', () => {
    const start = date('2026-02-20');

    for (const days of [-400, -1, 0, 1, 9, 400]) {
      expect(daysBetween(start, addDays(start, days))).toBe(days);
    }
  });
});

describe('isoWeekday', () => {
  test.each([
    ['1970-01-01', 4],
    ['2026-01-01', 4],
    ['2026-07-01', 3],
    ['2026-09-05', 6],
    ['2026-09-06', 7],
    ['2026-09-07', 1],
    ['2028-02-29', 2],
  ])('isoWeekday(%s) = %i', (value, expected) => {
    expect(isoWeekday(date(value))).toBe(expected);
  });
});

describe('isoWeekStart', () => {
  test.each([
    ['2026-11-09', '2026-11-09'],
    ['2026-11-13', '2026-11-09'],
    ['2026-11-15', '2026-11-09'],
    ['2026-11-16', '2026-11-16'],
    ['2026-03-01', '2026-02-23'],
    ['2026-12-31', '2026-12-28'],
    ['2027-01-01', '2026-12-28'],
    ['2026-01-01', '2025-12-29'],
    ['2028-03-01', '2028-02-28'],
  ])('isoWeekStart(%s) = %s', (value, expected) => {
    expect(isoWeekStart(date(value))).toBe(expected);
  });

  test('always returns a Monday on or before the date, less than 7 days away', () => {
    let current = date('2025-12-01');

    for (let index = 0; index < 800; index += 1) {
      const start = isoWeekStart(current);

      expect(isoWeekday(start)).toBe(1);
      expect(daysBetween(start, current)).toBeGreaterThanOrEqual(0);
      expect(daysBetween(start, current)).toBeLessThan(7);
      current = addDays(current, 1);
    }
  });
});

describe('monthRange', () => {
  test.each([
    ['2028-02-10', '2028-02-01', '2028-02-29'],
    ['2027-02-10', '2027-02-01', '2027-02-28'],
    ['2026-04-30', '2026-04-01', '2026-04-30'],
    ['2026-12-15', '2026-12-01', '2026-12-31'],
    ['2026-01-31', '2026-01-01', '2026-01-31'],
  ])('monthRange(%s)', (value, start, end) => {
    expect(monthRange(date(value))).toEqual({ start, end });
  });
});

describe('isAfter', () => {
  const today = date('2026-11-13');

  test('is true only for later dates', () => {
    expect(isAfter(date('2026-11-14'), today)).toBe(true);
    expect(isAfter(date('2027-01-01'), today)).toBe(true);
    expect(isAfter(today, today)).toBe(false);
    expect(isAfter(date('2026-11-12'), today)).toBe(false);
  });
});
