import { weekRangeOf } from '@/shared/domain';

import { date } from '../domain/testing/sale-fixtures';
import { describeWeekRange, describeWeekStart } from './week-range-label';

describe('describeWeekRange', () => {
  it('writes a week inside one month', () => {
    expect(describeWeekRange(weekRangeOf(date('2026-11-04')))).toBe('del 2 al 8 de noviembre');
  });

  it('writes both months when the week crosses a month', () => {
    expect(describeWeekRange(weekRangeOf(date('2026-11-30')))).toBe(
      'del 30 de noviembre al 6 de diciembre',
    );
  });

  it('adds the years when the week crosses the year', () => {
    expect(describeWeekRange(weekRangeOf(date('2026-12-31')))).toBe(
      'del 28 de diciembre de 2026 al 3 de enero de 2027',
    );
  });
});

describe('describeWeekStart', () => {
  it('says the week starts on its Monday', () => {
    expect(describeWeekStart(weekRangeOf(date('2026-11-13')))).toBe('desde el lunes 9');
  });
});
