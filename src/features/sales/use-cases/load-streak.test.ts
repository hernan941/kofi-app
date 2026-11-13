import { addDays, saleRecordIdSchema, type LocalDate } from '@/shared/domain';

import { noSalesWeekOf, type NoSalesWeek } from '../domain';
import {
  date,
  epoch,
  fixtureId,
  makeSaleItem,
  makeSaleRecord,
} from '../domain/testing/sale-fixtures';
import { createInMemoryNoSalesWeekRepository } from '../testing/in-memory-no-sales-week-repository';
import { createInMemorySaleRepository } from '../testing/in-memory-sale-repository';
import { createDataChanges } from '@/core/db/data-changes';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';
import { loadStreak } from './load-streak';

const CURRENT = date('2026-07-06');

function recordId(n: number) {
  return saleRecordIdSchema.parse(fixtureId(4, n));
}

function setup() {
  const dataChanges = createDataChanges(new RecordingLogger());
  const sales = createInMemorySaleRepository({ dataChanges });
  const noSalesWeeks = createInMemoryNoSalesWeekRepository({ dataChanges });
  const spy = jest.spyOn(sales, 'activeWeekStartsBetween');
  return { sales, noSalesWeeks, spy };
}

function weekAgo(n: number): LocalDate {
  return addDays(CURRENT, -7 * n);
}

function sale(sales: ReturnType<typeof setup>['sales'], soldOn: LocalDate, n: number): void {
  sales.saveSync(
    makeSaleRecord([makeSaleItem(n)], {
      id: recordId(n),
      soldOn,
    }),
  );
}

function mark(weekStart: LocalDate): NoSalesWeek {
  const result = noSalesWeekOf(weekStart);
  if (!result.ok) throw new Error('Monday expected');
  return result.value;
}

describe('loadStreak', () => {
  it('counts sales and marks together and is zero when there is nothing', async () => {
    const { sales, noSalesWeeks } = setup();
    await expect(loadStreak({ sales, noSalesWeeks }, CURRENT)).resolves.toMatchObject({ weeks: 0 });

    sale(sales, weekAgo(1), 1);
    noSalesWeeks.markSync(mark(weekAgo(2)), epoch(1));
    sale(sales, CURRENT, 2);

    await expect(loadStreak({ sales, noSalesWeeks }, CURRENT)).resolves.toEqual({
      weeks: 3,
      includesCurrentWeek: true,
      oldestWeekStart: weekAgo(2),
    });
  });

  it('reads a single window for a short streak', async () => {
    const { sales, noSalesWeeks, spy } = setup();
    for (let n = 1; n <= 3; n += 1) sale(sales, weekAgo(n), n);

    const streak = await loadStreak({ sales, noSalesWeeks }, CURRENT);

    expect(streak.weeks).toBe(3);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('asks for exactly two windows for a streak of 30 weeks', async () => {
    const { sales, noSalesWeeks, spy } = setup();
    for (let n = 0; n < 30; n += 1) noSalesWeeks.markSync(mark(weekAgo(n)), epoch(1));

    const streak = await loadStreak({ sales, noSalesWeeks }, CURRENT);

    expect(streak).toMatchObject({ weeks: 30, oldestWeekStart: weekAgo(29) });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('asks for the next window when the streak ends at the window edge and stops at the gap', async () => {
    const { sales, noSalesWeeks, spy } = setup();
    for (let n = 0; n < 26; n += 1) noSalesWeeks.markSync(mark(weekAgo(n)), epoch(1));

    const streak = await loadStreak({ sales, noSalesWeeks }, CURRENT);

    expect(streak.weeks).toBe(26);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('ignores deleted records and records without items', async () => {
    const { sales, noSalesWeeks } = setup();
    sale(sales, weekAgo(1), 1);
    sales.softDeleteSync(recordId(1), epoch(2));
    sales.seed(makeSaleRecord([], { id: recordId(2), soldOn: weekAgo(1) }));

    await expect(loadStreak({ sales, noSalesWeeks }, CURRENT)).resolves.toMatchObject({ weeks: 0 });
  });
});
