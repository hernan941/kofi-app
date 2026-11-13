import { addDays, localDateSchema, type LocalDate } from '@/shared/domain';

import { homeRanges } from './periods';

const day = (value: string): LocalDate => localDateSchema.parse(value);

describe('homeRanges', () => {
  test('on a Monday the week segments have a single day', () => {
    const ranges = homeRanges(day('2026-11-09'));
    expect(ranges.weekToDate).toEqual({ start: '2026-11-09', end: '2026-11-09' });
    expect(ranges.previousWeekSegment).toEqual({ start: '2026-11-02', end: '2026-11-02' });
  });

  test('on a Sunday the week is complete and compared with the full previous week', () => {
    const ranges = homeRanges(day('2026-11-15'));
    expect(ranges.weekToDate).toEqual({ start: '2026-11-09', end: '2026-11-15' });
    expect(ranges.previousWeekSegment).toEqual({ start: '2026-11-02', end: '2026-11-08' });
  });

  test('a week that crosses two months starts in the previous month', () => {
    const ranges = homeRanges(day('2026-11-01'));
    expect(ranges.weekToDate).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(ranges.previousWeekSegment).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(ranges.monthToDate).toEqual({ start: '2026-11-01', end: '2026-11-01' });
    expect(ranges.previousMonthSegment).toEqual({ start: '2026-10-01', end: '2026-10-01' });
  });

  test('mid month compares the same day of the previous month', () => {
    const ranges = homeRanges(day('2026-11-12'));
    expect(ranges.monthToDate).toEqual({ start: '2026-11-01', end: '2026-11-12' });
    expect(ranges.previousMonthSegment).toEqual({ start: '2026-10-01', end: '2026-10-12' });
    expect(ranges.fetch).toEqual({ start: '2026-10-01', end: '2026-11-12' });
  });

  test('March 31 compares against all of February', () => {
    expect(homeRanges(day('2026-03-31')).previousMonthSegment).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  test('February 28 of a non-leap year compares against January 1 to 28', () => {
    expect(homeRanges(day('2027-02-28')).previousMonthSegment).toEqual({
      start: '2027-01-01',
      end: '2027-01-28',
    });
  });

  test('January compares against December of the previous year', () => {
    const ranges = homeRanges(day('2027-01-15'));
    expect(ranges.previousMonthSegment).toEqual({ start: '2026-12-01', end: '2026-12-15' });
    expect(ranges.fetch).toEqual({ start: '2026-12-01', end: '2027-01-15' });
  });

  test('fetch contains the four segments for every day from 2026 to 2028', () => {
    for (let date = day('2026-01-01'); date <= day('2028-12-31'); date = addDays(date, 1)) {
      const { fetch, weekToDate, previousWeekSegment, monthToDate, previousMonthSegment } =
        homeRanges(date);
      expect(fetch.end).toBe(date);
      for (const range of [weekToDate, previousWeekSegment, monthToDate, previousMonthSegment]) {
        expect(range.start >= fetch.start).toBe(true);
        expect(range.end <= fetch.end).toBe(true);
      }
    }
  });
});
