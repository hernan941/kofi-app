import { addDays, deterministicId, noSalesWeekIdSchema, weekRangeOf } from '@/shared/domain';

import {
  canUnmarkNoSales,
  noSalesPrompt,
  noSalesWeekId,
  noSalesWeekOf,
  noSalesWeekStatus,
  type WeekFacts,
} from './no-sales';
import { date } from './testing/sale-fixtures';

const facts = (weekStart: string, state: Partial<Omit<WeekFacts, 'week'>> = {}): WeekFacts => ({
  week: weekRangeOf(date(weekStart)),
  hasSales: false,
  isMarked: false,
  ...state,
});

describe('noSalesWeekId', () => {
  test('is stable for the same week', () => {
    expect(noSalesWeekId(date('2026-07-06'))).toBe(noSalesWeekId(date('2026-07-06')));
  });

  test('differs between weeks', () => {
    expect(noSalesWeekId(date('2026-07-06'))).not.toBe(noSalesWeekId(date('2026-07-13')));
  });

  test('is deterministicId of the week start text and a valid NoSalesWeekId', () => {
    const id = noSalesWeekId(date('2026-07-06'));

    expect(id).toBe(deterministicId('2026-07-06'));
    expect(noSalesWeekIdSchema.safeParse(id).success).toBe(true);
  });
});

describe('noSalesWeekOf', () => {
  test('builds the mark for a Monday', () => {
    expect(noSalesWeekOf(date('2026-07-06'))).toEqual({
      ok: true,
      value: { id: noSalesWeekId(date('2026-07-06')), weekStart: date('2026-07-06') },
    });
  });

  test('a Wednesday is not_a_week_start', () => {
    expect(noSalesWeekOf(date('2026-07-08'))).toEqual({
      ok: false,
      error: [{ code: 'not_a_week_start', path: ['weekStart'] }],
    });
  });
});

describe('noSalesWeekStatus (D-18, D-25)', () => {
  const today = date('2026-07-08');

  test('markable for the current and the previous week', () => {
    expect(noSalesWeekStatus(facts('2026-07-06'), today)).toBe('markable');
    expect(noSalesWeekStatus(facts('2026-06-29'), today)).toBe('markable');
  });

  test('marked, and has_sales wins over marked', () => {
    expect(noSalesWeekStatus(facts('2026-07-06', { isMarked: true }), today)).toBe('marked');
    expect(noSalesWeekStatus(facts('2026-07-06', { isMarked: true, hasSales: true }), today)).toBe(
      'has_sales',
    );
  });

  test('has_sales', () => {
    expect(noSalesWeekStatus(facts('2026-07-06', { hasSales: true }), today)).toBe('has_sales');
  });

  test('not_allowed two weeks back, in the future and for a non-Monday start', () => {
    expect(noSalesWeekStatus(facts('2026-06-22'), today)).toBe('not_allowed');
    expect(noSalesWeekStatus(facts('2026-07-13'), today)).toBe('not_allowed');
    expect(
      noSalesWeekStatus(
        { ...facts('2026-07-06'), week: { start: date('2026-07-07'), end: date('2026-07-13') } },
        today,
      ),
    ).toBe('not_allowed');
  });

  test('not_allowed wins over has_sales for old weeks', () => {
    expect(noSalesWeekStatus(facts('2026-06-22', { hasSales: true }), today)).toBe('not_allowed');
  });
});

describe('noSalesPrompt (ADR-007)', () => {
  const prompt = (today: string, current: Partial<WeekFacts>, previous: Partial<WeekFacts>) => {
    const currentWeek = weekRangeOf(date(today));
    return noSalesPrompt(
      date(today),
      { ...facts(currentWeek.start), ...current },
      { ...facts(addDays(currentWeek.start, -7)), ...previous },
    );
  };

  test('Wednesday with nothing: single current', () => {
    expect(prompt('2026-07-08', {}, {})).toEqual({
      kind: 'single',
      week: weekRangeOf(date('2026-07-06')),
      which: 'current',
    });
  });

  test('Monday with the previous week empty: choose, previous preselected', () => {
    expect(prompt('2026-07-06', {}, {})).toEqual({
      kind: 'choose',
      previous: weekRangeOf(date('2026-06-29')),
      current: weekRangeOf(date('2026-07-06')),
      preselected: 'previous',
    });
  });

  test('Tuesday also chooses', () => {
    expect(prompt('2026-07-07', {}, {}).kind).toBe('choose');
  });

  test('Wednesday never chooses', () => {
    expect(prompt('2026-07-08', {}, {}).kind).toBe('single');
  });

  test('Tuesday with sales in the previous week: single current', () => {
    expect(prompt('2026-07-07', {}, { hasSales: true })).toMatchObject({
      kind: 'single',
      which: 'current',
    });
  });

  test('Monday with the previous week marked: single current', () => {
    expect(prompt('2026-07-06', {}, { isMarked: true })).toMatchObject({
      kind: 'single',
      which: 'current',
    });
  });

  test('Monday with the previous empty and the current with sales: single previous', () => {
    expect(prompt('2026-07-06', { hasSales: true }, {})).toEqual({
      kind: 'single',
      week: weekRangeOf(date('2026-06-29')),
      which: 'previous',
    });
  });

  test('Monday with the previous empty and the current marked: single previous', () => {
    expect(prompt('2026-07-06', { isMarked: true }, {})).toMatchObject({
      kind: 'single',
      which: 'previous',
    });
  });

  test('Thursday with sales: has_sales', () => {
    expect(prompt('2026-07-09', { hasSales: true }, {})).toEqual({
      kind: 'has_sales',
      week: weekRangeOf(date('2026-07-06')),
    });
  });

  test('current marked: marked', () => {
    expect(prompt('2026-07-09', { isMarked: true }, {})).toEqual({
      kind: 'marked',
      week: weekRangeOf(date('2026-07-06')),
    });
  });

  test('year crossing: Monday 2027-01-04 chooses between 2026-12-28 and itself', () => {
    expect(prompt('2027-01-04', {}, {})).toEqual({
      kind: 'choose',
      previous: weekRangeOf(date('2026-12-28')),
      current: weekRangeOf(date('2027-01-04')),
      preselected: 'previous',
    });
  });

  test('throws when the facts do not describe the current week', () => {
    expect(() =>
      noSalesPrompt(date('2026-07-08'), facts('2026-06-29'), facts('2026-06-22')),
    ).toThrow(RangeError);
  });
});

describe('canUnmarkNoSales', () => {
  const today = date('2026-07-08');

  test('current and previous week', () => {
    expect(canUnmarkNoSales(date('2026-07-06'), today)).toBe(true);
    expect(canUnmarkNoSales(date('2026-06-29'), today)).toBe(true);
  });

  test('two weeks back, the future and non-Mondays', () => {
    expect(canUnmarkNoSales(date('2026-06-22'), today)).toBe(false);
    expect(canUnmarkNoSales(date('2026-07-13'), today)).toBe(false);
    expect(canUnmarkNoSales(date('2026-07-07'), today)).toBe(false);
  });
});
