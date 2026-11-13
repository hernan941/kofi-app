import { noSalesWeekOf } from './no-sales';
import { STREAK_SCAN_WEEKS, registeredWeeks, streakFrom } from './streak';
import { date } from './testing/sale-fixtures';

const W0 = date('2026-12-28');
const W1 = date('2027-01-04');
const W2 = date('2027-01-11');

function weeks(...starts: string[]) {
  return new Set(starts.map((start) => date(start)));
}

describe('streakFrom', () => {
  it('counts consecutive registered weeks across the new year', () => {
    expect(streakFrom(W2, weeks('2027-01-11', '2027-01-04', '2026-12-28', '2026-12-14'))).toEqual({
      weeks: 3,
      includesCurrentWeek: true,
      oldestWeekStart: W0,
    });
  });

  it('does not break when only the current week is unregistered', () => {
    expect(streakFrom(W2, weeks('2027-01-04', '2026-12-28'))).toEqual({
      weeks: 2,
      includesCurrentWeek: false,
      oldestWeekStart: W0,
    });
  });

  it('is zero when the previous week is unregistered', () => {
    expect(streakFrom(W2, weeks('2027-01-11', '2026-12-28'))).toEqual({
      weeks: 1,
      includesCurrentWeek: true,
      oldestWeekStart: W2,
    });
    expect(streakFrom(W2, weeks('2026-12-28'))).toEqual({
      weeks: 0,
      includesCurrentWeek: false,
      oldestWeekStart: null,
    });
  });

  it('is zero with no registered weeks', () => {
    expect(streakFrom(W1, new Set())).toEqual({
      weeks: 0,
      includesCurrentWeek: false,
      oldestWeekStart: null,
    });
  });
});

describe('registeredWeeks', () => {
  it('unites the weeks with sales and the active marks', () => {
    const mark = noSalesWeekOf(W1);
    if (!mark.ok) throw new Error('Monday expected');

    expect(registeredWeeks([W0], [mark.value])).toEqual(new Set([W0, W1]));
  });
});

describe('STREAK_SCAN_WEEKS', () => {
  it('is 26 weeks', () => {
    expect(STREAK_SCAN_WEEKS).toBe(26);
  });
});
