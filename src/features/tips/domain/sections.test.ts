import { BUNDLED_TIPS } from './catalog';
import { findTip, tipSections } from './sections';
import { TIP_CATEGORIES } from './tip';
import { makeTip, makeView, tipId, viewsOf } from './testing/tip-fixtures';

describe('tipSections', () => {
  test('builds one section per category, in the order of TIP_CATEGORIES, with the real catalog', () => {
    const sections = tipSections(BUNDLED_TIPS, viewsOf());
    expect(sections.map((section) => section.category)).toEqual(TIP_CATEGORIES);
    expect(sections.flatMap((section) => section.items).length).toBe(BUNDLED_TIPS.length);
  });

  test('marks seen tips from the views and keeps the catalog order inside a section', () => {
    const tips = [
      makeTip('a', { category: 'costs' }),
      makeTip('b', { category: 'costs' }),
      makeTip('c', { category: 'recording' }),
    ];
    const sections = tipSections(tips, viewsOf(makeView('b', 10)));
    expect(sections).toEqual([
      { category: 'recording', items: [{ tip: tips[2], seen: false }] },
      {
        category: 'costs',
        items: [
          { tip: tips[0], seen: false },
          { tip: tips[1], seen: true },
        ],
      },
    ]);
  });

  test('omits categories without tips', () => {
    expect(
      tipSections([makeTip('a', { category: 'fairs' })], viewsOf()).map((s) => s.category),
    ).toEqual(['fairs']);
  });
});

describe('findTip', () => {
  const tips = [makeTip('a'), makeTip('b')];

  test('finds a tip by id', () => {
    expect(findTip(tips, tipId('b'))).toBe(tips[1]);
  });

  test('returns null for an unknown id', () => {
    expect(findTip(tips, tipId('zzz'))).toBeNull();
  });
});
