import { buildDayDetail } from './day-detail';
import { day, record, saleOf } from './testing/tracking-fixtures';

describe('buildDayDetail', () => {
  const today = day('2026-11-12');

  it('totals and counts the records of the day', () => {
    const detail = buildDayDetail(day('2026-11-10'), today, [
      saleOf('2026-11-10', 15000),
      saleOf('2026-11-10', 30000),
      saleOf('2026-11-09', 99),
    ]);

    expect(detail).toEqual({
      date: day('2026-11-10'),
      total: 45000,
      recordCount: 2,
      canRegister: true,
    });
  });

  it('ignores records without items', () => {
    expect(buildDayDetail(day('2026-11-10'), today, [record('2026-11-10', [])])).toMatchObject({
      total: 0,
      recordCount: 0,
    });
  });

  it('lets register today and the past but not tomorrow', () => {
    expect(buildDayDetail(today, today, []).canRegister).toBe(true);
    expect(buildDayDetail(day('2026-01-01'), today, []).canRegister).toBe(true);
    expect(buildDayDetail(day('2026-11-13'), today, []).canRegister).toBe(false);
  });
});
