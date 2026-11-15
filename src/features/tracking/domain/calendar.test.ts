import { noSalesWeekOf, noSalesWeekStatus, type NoSalesWeek } from '@/features/sales/domain';
import { weekRangeOf, yearMonthSchema } from '@/shared/domain';

import {
  buildCalendarMonth,
  calendarNavigationLimit,
  dailyActivity,
  intensityLevels,
  weekFactsOf,
  type DayActivity,
} from './calendar';
import { clp, day, item, record, saleOf } from './testing/tracking-fixtures';

const month = (text: string) => yearMonthSchema.parse(text);

function mark(weekStart: string): NoSalesWeek {
  const result = noSalesWeekOf(day(weekStart));
  if (!result.ok) throw new Error('Monday expected');
  return result.value;
}

function activityOf(entries: readonly (readonly [string, number])[]) {
  return new Map<ReturnType<typeof day>, DayActivity>(
    entries.map(([date, total]) => [
      day(date),
      { date: day(date), total: clp(total), recordCount: 1 },
    ]),
  );
}

describe('dailyActivity', () => {
  it('sums the records of a day and counts them', () => {
    const result = dailyActivity([
      saleOf('2026-11-12', 15000),
      saleOf('2026-11-12', 30000),
      saleOf('2026-11-10', 2000),
    ]);

    expect(result.get(day('2026-11-12'))).toEqual({
      date: day('2026-11-12'),
      total: 45000,
      recordCount: 2,
    });
    expect(result.get(day('2026-11-10'))?.recordCount).toBe(1);
    expect(result.size).toBe(2);
  });

  it('ignores a record without active items', () => {
    const result = dailyActivity([record('2026-11-12', [])]);

    expect(result.size).toBe(0);
  });
});

describe('intensityLevels', () => {
  const november = month('2026-11');

  it('gives the best day of the month level 3, also when it is the only one', () => {
    const levels = intensityLevels(activityOf([['2026-11-12', 500]]), november);

    expect(levels.get(day('2026-11-12'))).toBe(3);
  });

  it('gives level 3 to every day that ties for the maximum', () => {
    const levels = intensityLevels(
      activityOf([
        ['2026-11-02', 9000],
        ['2026-11-03', 9000],
      ]),
      november,
    );

    expect(levels.get(day('2026-11-02'))).toBe(3);
    expect(levels.get(day('2026-11-03'))).toBe(3);
  });

  it('splits the proportions at one third and two thirds', () => {
    const levels = intensityLevels(
      activityOf([
        ['2026-11-01', 9000],
        ['2026-11-02', 3000],
        ['2026-11-03', 3001],
        ['2026-11-04', 6000],
        ['2026-11-05', 6001],
        ['2026-11-06', 1],
      ]),
      november,
    );

    expect([1, 2, 3, 4, 5, 6].map((n) => levels.get(day(`2026-11-0${String(n)}`)))).toEqual([
      3, 1, 2, 2, 3, 1,
    ]);
  });

  it('gives level 1 when every sale is for $0', () => {
    const levels = intensityLevels(activityOf([['2026-11-12', 0]]), november);

    expect(levels.get(day('2026-11-12'))).toBe(1);
  });

  it('leaves days without sales without a level', () => {
    const levels = intensityLevels(activityOf([['2026-11-12', 500]]), november);

    expect(levels.has(day('2026-11-13'))).toBe(false);
  });

  it('ignores the days of other months, also for the maximum', () => {
    const levels = intensityLevels(
      activityOf([
        ['2026-10-30', 900000],
        ['2026-11-12', 500],
      ]),
      november,
    );

    expect(levels.has(day('2026-10-30'))).toBe(false);
    expect(levels.get(day('2026-11-12'))).toBe(3);
  });
});

describe('buildCalendarMonth', () => {
  const november = month('2026-11');
  const today = day('2026-11-12');

  it('lays out November 2026 in six weeks from Monday October 26', () => {
    const calendar = buildCalendarMonth(november, today, [], []);

    expect(calendar.weeks).toHaveLength(6);
    expect(calendar.weeks[0]?.week.start).toBe('2026-10-26');
    expect(calendar.weeks[0]?.days.map((d) => d.inMonth)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(calendar.weeks[5]?.days.at(-1)?.date).toBe('2026-12-06');
  });

  it('flags today and the future', () => {
    const days = buildCalendarMonth(november, today, [], []).weeks.flatMap((week) => week.days);
    const byDate = (date: string) => days.find((d) => d.date === date);

    expect(byDate('2026-11-12')).toMatchObject({ isToday: true, isFuture: false });
    expect(byDate('2026-11-11')).toMatchObject({ isToday: false, isFuture: false });
    expect(byDate('2026-11-13')).toMatchObject({ isToday: false, isFuture: true });
  });

  it('attaches the activity and the level to the days of the month', () => {
    const calendar = buildCalendarMonth(
      november,
      today,
      [saleOf('2026-11-12', 45000), saleOf('2026-11-03', 1000)],
      [],
    );
    const days = calendar.weeks.flatMap((week) => week.days);

    expect(days.find((d) => d.date === '2026-11-12')).toMatchObject({
      activity: { total: 45000, recordCount: 1 },
      level: 3,
    });
    expect(days.find((d) => d.date === '2026-11-03')?.level).toBe(1);
    expect(days.find((d) => d.date === '2026-11-04')).toMatchObject({ activity: null, level: 0 });
  });

  it('marks the weeks with an active "no vendí"', () => {
    const calendar = buildCalendarMonth(november, today, [], [mark('2026-11-02')]);

    expect(calendar.weeks.map((week) => week.noSalesMarked)).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it('totals only the days of the month, not the filler days', () => {
    const calendar = buildCalendarMonth(
      november,
      today,
      [saleOf('2026-10-28', 700), saleOf('2026-11-12', 300), saleOf('2026-12-02', 50)],
      [],
    );

    expect(calendar.monthTotal).toBe(300);
    const filler = calendar.weeks[0]?.days[2];
    expect(filler).toMatchObject({ inMonth: false, activity: null, level: 0 });
  });
});

describe('CalendarMonth.hasSales', () => {
  const november = month('2026-11');
  const today = day('2026-11-12');

  it('is false without sales', () => {
    expect(buildCalendarMonth(november, today, [], []).hasSales).toBe(false);
  });

  it('is true with a sale inside the month', () => {
    expect(buildCalendarMonth(november, today, [saleOf('2026-11-03', 1000)], []).hasSales).toBe(
      true,
    );
  });

  it('ignores the sales of the filler days and the "no vendí" marks', () => {
    const calendar = buildCalendarMonth(
      november,
      today,
      [saleOf('2026-10-28', 700), saleOf('2026-12-02', 50)],
      [mark('2026-11-02')],
    );

    expect(calendar.hasSales).toBe(false);
  });
});

describe('calendarNavigationLimit', () => {
  it('is the month of the previous week when there are no sales', () => {
    expect(calendarNavigationLimit(day('2026-11-12'), null)).toBe('2026-11');
    expect(calendarNavigationLimit(day('2026-11-02'), null)).toBe('2026-10');
  });

  it('is the first month with sales when it is older than the previous week', () => {
    expect(calendarNavigationLimit(day('2026-11-12'), month('2026-03'))).toBe('2026-03');
  });

  it('keeps the month of the previous week when the first sale is more recent', () => {
    expect(calendarNavigationLimit(day('2026-11-02'), month('2026-11'))).toBe('2026-10');
    expect(calendarNavigationLimit(day('2026-11-02'), month('2026-10'))).toBe('2026-10');
  });
});

describe('weekFactsOf with noSalesWeekStatus', () => {
  const today = day('2026-11-12');
  const week = weekRangeOf(today);

  it('reads sales and marks of the week', () => {
    expect(
      weekFactsOf(week, [saleOf('2026-11-10', 100), saleOf('2026-11-20', 100)], []),
    ).toMatchObject({ hasSales: true, isMarked: false });
    expect(weekFactsOf(week, [saleOf('2026-11-20', 100)], [mark('2026-11-09')])).toMatchObject({
      hasSales: false,
      isMarked: true,
    });
  });

  it('keeps a week with an item-less record markable', () => {
    const facts = weekFactsOf(week, [record('2026-11-10', [])], []);

    expect(noSalesWeekStatus(facts, today)).toBe('markable');
  });

  it('is has_sales with a record that has an item', () => {
    const facts = weekFactsOf(week, [record('2026-11-10', [item()])], []);

    expect(noSalesWeekStatus(facts, today)).toBe('has_sales');
  });
});
