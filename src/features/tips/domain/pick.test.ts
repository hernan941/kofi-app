import { BUNDLED_TIPS } from './catalog';
import type { TipContext } from './context';
import { pickTipAfterSale, rotationOrder } from './pick';
import type { Tip } from './tip';
import { makeTip, makeView, viewsOf } from './testing/tip-fixtures';

const PLAIN: TipContext = {
  hasAnyCost: true,
  isFirstSale: false,
  channel: 'other',
  streakWeeks: 0,
};

function ctx(overrides: Partial<TipContext> = {}): TipContext {
  return { ...PLAIN, ...overrides };
}

function ids(tips: readonly Tip[]): readonly string[] {
  return tips.map((tip) => tip.id);
}

describe('rotationOrder', () => {
  test('alternates categories and keeps the catalog order inside each one', () => {
    const tips = [
      makeTip('r1', { category: 'recording' }),
      makeTip('r2', { category: 'recording' }),
      makeTip('c1', { category: 'costs' }),
      makeTip('c2', { category: 'costs' }),
      makeTip('p1', { category: 'pricing' }),
    ];
    expect(ids(rotationOrder(tips))).toEqual(['r1', 'c1', 'p1', 'r2', 'c2']);
  });

  test('skips categories that run out', () => {
    const tips = [
      makeTip('r1', { category: 'recording' }),
      makeTip('r2', { category: 'recording' }),
      makeTip('r3', { category: 'recording' }),
      makeTip('f1', { category: 'fairs' }),
    ];
    expect(ids(rotationOrder(tips))).toEqual(['r1', 'f1', 'r2', 'r3']);
  });

  test('keeps every tip of the real catalog exactly once', () => {
    expect([...ids(rotationOrder(BUNDLED_TIPS))].sort()).toEqual([...ids(BUNDLED_TIPS)].sort());
  });

  test('returns an empty list for an empty catalog', () => {
    expect(rotationOrder([])).toEqual([]);
  });
});

describe('pickTipAfterSale', () => {
  test('returns null with an empty catalog', () => {
    expect(pickTipAfterSale([], viewsOf(), ctx())).toBeNull();
  });

  test('without costs a cost tip has priority until both are seen', () => {
    const tips = [
      makeTip('r1', { category: 'recording' }),
      makeTip('k1', { category: 'costs', trigger: 'no_costs' }),
      makeTip('k2', { category: 'costs', trigger: 'no_costs' }),
    ];
    const noCosts = ctx({ hasAnyCost: false });
    expect(pickTipAfterSale(tips, viewsOf(), noCosts)?.id).toBe('k1');
    expect(pickTipAfterSale(tips, viewsOf(makeView('k1', 10)), noCosts)?.id).toBe('k2');
    const bothSeen = viewsOf(makeView('k1', 10), makeView('k2', 20));
    expect(pickTipAfterSale(tips, bothSeen, noCosts)?.id).toBe('r1');
  });

  test('does not repeat a seen tip while unseen ones remain', () => {
    const tips = [makeTip('a'), makeTip('b'), makeTip('c')];
    expect(pickTipAfterSale(tips, viewsOf(makeView('a', 10)), ctx())?.id).toBe('b');
    expect(pickTipAfterSale(tips, viewsOf(makeView('a', 10), makeView('b', 20)), ctx())?.id).toBe(
      'c',
    );
  });

  test('when everything is seen picks the least recently seen by lastSeenAt, not firstSeenAt', () => {
    const tips = [makeTip('a'), makeTip('b')];
    const views = viewsOf(makeView('a', 500, 1), makeView('b', 100, 50));
    expect(pickTipAfterSale(tips, views, ctx())?.id).toBe('b');
  });

  test('ties on lastSeenAt are broken by rotation order and are deterministic', () => {
    const tips = [makeTip('r1', { category: 'recording' }), makeTip('c1', { category: 'costs' })];
    const views = viewsOf(makeView('c1', 100), makeView('r1', 100));
    const first = pickTipAfterSale(tips, views, ctx());
    expect(first?.id).toBe('r1');
    expect(pickTipAfterSale(tips, views, ctx())).toBe(first);
  });

  test('a first sale without costs shows a cost tip', () => {
    const tip = pickTipAfterSale(
      BUNDLED_TIPS,
      viewsOf(),
      ctx({ hasAnyCost: false, isFirstSale: true }),
    );
    expect(tip?.id).toBe('costos-para-que-sirven');
  });

  test('a first sale with costs shows the first-sale tip', () => {
    expect(pickTipAfterSale(BUNDLED_TIPS, viewsOf(), ctx({ isFirstSale: true }))?.id).toBe(
      'registro-primera-venta',
    );
  });

  test('the first-sale tip is never picked outside the first sale, even with everything seen', () => {
    const allSeen = viewsOf(...BUNDLED_TIPS.map((tip, index) => makeView(tip.id, 1000 + index)));
    const onlyFirstSaleUnseen = viewsOf(
      ...BUNDLED_TIPS.filter((tip) => tip.id !== 'registro-primera-venta').map((tip) =>
        makeView(tip.id, 1000),
      ),
    );
    for (const views of [viewsOf(), allSeen, onlyFirstSaleUnseen]) {
      expect(pickTipAfterSale(BUNDLED_TIPS, views, ctx())?.id).not.toBe('registro-primera-venta');
    }
    const oldest = viewsOf(
      ...BUNDLED_TIPS.map((tip) =>
        makeView(tip.id, tip.id === 'registro-primera-venta' ? 1 : 1000),
      ),
    );
    expect(pickTipAfterSale(BUNDLED_TIPS, oldest, ctx())?.id).not.toBe('registro-primera-venta');
  });

  test('a fair sale with costs shows a fair_sale tip', () => {
    const tip = pickTipAfterSale(BUNDLED_TIPS, viewsOf(), ctx({ channel: 'fair' }));
    expect(tip?.trigger).toBe('fair_sale');
  });

  test('fair_sale has priority over streak, and streak over no_channel', () => {
    const tips = [
      makeTip('n1', { category: 'recording', trigger: 'no_channel' }),
      makeTip('s1', { category: 'costs', trigger: 'streak' }),
      makeTip('f1', { category: 'pricing', trigger: 'fair_sale' }),
    ];
    expect(pickTipAfterSale(tips, viewsOf(), ctx({ channel: 'fair', streakWeeks: 4 }))?.id).toBe(
      'f1',
    );
    expect(pickTipAfterSale(tips, viewsOf(), ctx({ channel: null, streakWeeks: 4 }))?.id).toBe(
      's1',
    );
    expect(pickTipAfterSale(tips, viewsOf(), ctx({ channel: null }))?.id).toBe('n1');
  });

  test('first_sale has priority over fair_sale and below no_costs', () => {
    const tips = [
      makeTip('f1', { category: 'recording', trigger: 'fair_sale' }),
      makeTip('p1', { category: 'costs', trigger: 'first_sale' }),
      makeTip('k1', { category: 'pricing', trigger: 'no_costs' }),
    ];
    const fairFirst = ctx({ channel: 'fair', isFirstSale: true });
    expect(pickTipAfterSale(tips, viewsOf(), fairFirst)?.id).toBe('p1');
    expect(pickTipAfterSale(tips, viewsOf(), { ...fairFirst, hasAnyCost: false })?.id).toBe('k1');
  });

  test('ignores views of ids that are not in the catalog', () => {
    const tips = [makeTip('a'), makeTip('b')];
    const views = viewsOf(makeView('removed-tip', 1), makeView('a', 10));
    expect(pickTipAfterSale(tips, views, ctx())?.id).toBe('b');
    expect(pickTipAfterSale(tips, viewsOf(makeView('removed-tip', 1)), ctx())?.id).toBe('a');
  });

  test('returns null when the only tips are first-sale tips and it is not the first sale', () => {
    const tips = [makeTip('p1', { trigger: 'first_sale' })];
    expect(pickTipAfterSale(tips, viewsOf(), ctx())).toBeNull();
  });
});
