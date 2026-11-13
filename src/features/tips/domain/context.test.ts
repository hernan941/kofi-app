import { STREAK_TIP_MIN_WEEKS, activeTriggers, hasAnyCostLoaded, type TipContext } from './context';

const BASE: TipContext = { hasAnyCost: true, isFirstSale: false, channel: 'other', streakWeeks: 0 };

function triggersOf(overrides: Partial<TipContext>): readonly string[] {
  return [...activeTriggers({ ...BASE, ...overrides })].sort();
}

describe('activeTriggers', () => {
  test('a context with nothing special activates nothing', () => {
    expect(triggersOf({})).toEqual([]);
  });

  test('no loaded costs activates no_costs', () => {
    expect(triggersOf({ hasAnyCost: false })).toEqual(['no_costs']);
  });

  test('the first sale activates first_sale', () => {
    expect(triggersOf({ isFirstSale: true })).toEqual(['first_sale']);
  });

  test('a streak activates streak from 3 weeks and not before', () => {
    expect(STREAK_TIP_MIN_WEEKS).toBe(3);
    expect(triggersOf({ streakWeeks: 2 })).toEqual([]);
    expect(triggersOf({ streakWeeks: 3 })).toEqual(['streak']);
  });

  test('a null channel activates no_channel', () => {
    expect(triggersOf({ channel: null })).toEqual(['no_channel']);
  });

  test('the fair channel activates fair_sale and not no_channel', () => {
    expect(triggersOf({ channel: 'fair' })).toEqual(['fair_sale']);
  });

  test('several facts activate several triggers', () => {
    expect(
      triggersOf({ hasAnyCost: false, isFirstSale: true, channel: null, streakWeeks: 5 }),
    ).toEqual(['first_sale', 'no_channel', 'no_costs', 'streak']);
  });
});

describe('hasAnyCostLoaded', () => {
  const version = (cost: number | null, archivedAt: number | null = null) => ({
    cost,
    archivedAt,
  });

  test('is false without products', () => {
    expect(hasAnyCostLoaded([])).toBe(false);
  });

  test('is false when no version has a cost', () => {
    expect(hasAnyCostLoaded([{ archivedAt: null, versions: [version(null)] }])).toBe(false);
  });

  test('a cost of zero counts as loaded', () => {
    expect(hasAnyCostLoaded([{ archivedAt: null, versions: [version(0)] }])).toBe(true);
  });

  test('a cost only on an archived version does not count', () => {
    expect(hasAnyCostLoaded([{ archivedAt: null, versions: [version(500, 1)] }])).toBe(false);
  });

  test('a cost on an archived product does not count', () => {
    expect(hasAnyCostLoaded([{ archivedAt: 1, versions: [version(500)] }])).toBe(false);
  });

  test('finds a cost in any of the products', () => {
    expect(
      hasAnyCostLoaded([
        { archivedAt: null, versions: [version(null)] },
        { archivedAt: null, versions: [version(null), version(900)] },
      ]),
    ).toBe(true);
  });
});
