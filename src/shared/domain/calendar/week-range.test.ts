import { localDateSchema } from './local-date';
import { weekRangeOf } from './week-range';

describe('weekRangeOf', () => {
  test('returns Monday to Sunday for a mid-week date', () => {
    expect(weekRangeOf(localDateSchema.parse('2026-11-12'))).toEqual({
      start: '2026-11-09',
      end: '2026-11-15',
    });
  });

  test('keeps Monday as the start and Sunday as the end', () => {
    expect(weekRangeOf(localDateSchema.parse('2026-11-09')).start).toBe('2026-11-09');
    expect(weekRangeOf(localDateSchema.parse('2026-11-15'))).toEqual({
      start: '2026-11-09',
      end: '2026-11-15',
    });
  });

  test('crosses a month and year boundary', () => {
    expect(weekRangeOf(localDateSchema.parse('2026-12-31'))).toEqual({
      start: '2026-12-28',
      end: '2027-01-03',
    });
  });
});
