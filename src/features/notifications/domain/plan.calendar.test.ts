import {
  TIME_ZONE_FIXTURES,
  type FixtureTimeZone,
} from '@/shared/domain/calendar/__fixtures__/time-zones';
import {
  addDays,
  deviceLocalCalendar as calendar,
  epochMsSchema,
  isoWeekStart,
  localDateSchema,
  type EpochMs,
  type IsoWeekday,
} from '@/shared/domain';

import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from './preferences';
import {
  FALLBACK_WEEKS,
  MAX_PENDING_NOTIFICATIONS,
  MONTHS_AHEAD,
  planNotifications,
  weeklyInstantToRemember,
  weeklyReminderInstant,
  type NotificationPlanInput,
  type PlannedNotification,
} from './plan';
import { monthlySummaryContent, weeklyReminderContent } from './texts';

const date = (text: string) => localDateSchema.parse(text);
const local = (text: string, minuteOfDay: number): EpochMs =>
  calendar.instantAt(date(text), minuteOfDay);

function prefs(
  weekly: Partial<NotificationPreferences['weekly']> = {},
  monthlyEnabled = true,
): NotificationPreferences {
  return {
    weekly: { ...DEFAULT_NOTIFICATION_PREFERENCES.weekly, ...weekly },
    monthly: { enabled: monthlyEnabled },
  };
}

function plan(overrides: Partial<NotificationPlanInput> & { now: EpochMs }) {
  return planNotifications({
    calendar,
    preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    currentWeekRegistered: false,
    lastWeeklyFireAt: null,
    fallbackWeeks: FALLBACK_WEEKS,
    monthsAhead: MONTHS_AHEAD,
    ...overrides,
  });
}

const weeklyOnes = (items: readonly PlannedNotification[]) =>
  items.filter((n) => n.kind === 'weekly_reminder' && n.trigger.type === 'once');
const monthlies = (items: readonly PlannedNotification[]) =>
  items.filter((n) => n.kind === 'monthly_summary');
const ids = (items: readonly PlannedNotification[]) => items.map((n) => n.identifier);

const fireAtOf = (n: PlannedNotification): EpochMs =>
  n.trigger.type === 'once' ? n.trigger.fireAt : epochMsSchema.parse(0);

const MONDAY = '2026-11-09';
const NOW_FRIDAY = local('2026-11-13', 720);

describe('weeklyReminderInstant', () => {
  const sunday = prefs().weekly;

  test.each([
    ['today before the hour', local('2026-11-15', 600)],
    ['today after the hour', local('2026-11-15', 1300)],
    ['a day that has not arrived', local('2026-11-11', 600)],
    ['a day that already passed', local('2026-11-14', 600)],
  ])('lands on the configured day of the current week: %s', (_name, instant) => {
    const today = calendar.localDateOf(instant);
    expect(weeklyReminderInstant(today, sunday, calendar)).toBe(local('2026-11-15', 1200));
  });

  test('works for a Wednesday configuration', () => {
    expect(
      weeklyReminderInstant(
        date('2026-11-15'),
        prefs({ weekday: 3, minuteOfDay: 510 }).weekly,
        calendar,
      ),
    ).toBe(local('2026-11-11', 510));
  });
});

describe('planNotifications state A', () => {
  test('an unregistered week has only the repeating neutral reminder', () => {
    const result = plan({ now: NOW_FRIDAY });

    expect(weeklyOnes(result)).toHaveLength(0);
    expect(result.filter((n) => n.kind === 'weekly_reminder')).toEqual([
      {
        identifier: 'cv.weekly.repeat',
        kind: 'weekly_reminder',
        trigger: { type: 'weekly', weekday: 7, minuteOfDay: 1200 },
        content: weeklyReminderContent('neutral'),
      },
    ]);
  });

  test('a registered week whose reminder time already passed is state A', () => {
    const result = plan({
      now: local('2026-11-15', 1300),
      currentWeekRegistered: true,
    });

    expect(ids(result)).toContain('cv.weekly.repeat');
    expect(weeklyOnes(result)).toHaveLength(0);
  });

  test('has 13 pending with the monthly summaries', () => {
    expect(plan({ now: NOW_FRIDAY })).toHaveLength(1 + MONTHS_AHEAD);
  });
});

describe('planNotifications state B', () => {
  const registered = () => plan({ now: NOW_FRIDAY, currentWeekRegistered: true });

  test('replaces the repeat with a one-shot already_registered at T', () => {
    const result = registered();

    expect(ids(result)).not.toContain('cv.weekly.repeat');
    expect(result.find((n) => n.identifier === `cv.weekly.${MONDAY}`)).toEqual({
      identifier: `cv.weekly.${MONDAY}`,
      kind: 'weekly_reminder',
      trigger: { type: 'once', fireAt: local('2026-11-15', 1200) },
      content: weeklyReminderContent('already_registered'),
    });
  });

  test('adds 47 neutral one-shots on the following weeks', () => {
    const neutrals = weeklyOnes(registered()).filter((n) => n.identifier !== `cv.weekly.${MONDAY}`);

    expect(neutrals).toHaveLength(FALLBACK_WEEKS);
    neutrals.forEach((n, index) => {
      const monday = addDays(date(MONDAY), 7 * (index + 1));
      expect(n.identifier).toBe(`cv.weekly.${monday}`);
      expect(n.content).toEqual(weeklyReminderContent('neutral'));
      expect(n.trigger).toEqual({ type: 'once', fireAt: local(addDays(monday, 6), 1200) });
    });
  });

  test('has 60 pending at most', () => {
    expect(registered()).toHaveLength(60);
    expect(registered().length).toBeLessThanOrEqual(MAX_PENDING_NOTIFICATIONS);
  });

  test('transitions A to B to A with the registration and the passing of T', () => {
    const stateA = plan({ now: NOW_FRIDAY });
    const stateB = registered();
    const afterT = plan({ now: local('2026-11-15', 1201), currentWeekRegistered: true });
    const unregisteredAgain = plan({ now: NOW_FRIDAY, currentWeekRegistered: false });

    expect(ids(stateA)).toContain('cv.weekly.repeat');
    expect(ids(stateB)).not.toContain('cv.weekly.repeat');
    expect(ids(afterT)).toContain('cv.weekly.repeat');
    expect(unregisteredAgain).toEqual(stateA);
  });
});

describe('planNotifications monthly summaries', () => {
  test('plans 12 on day 1 at 10:00 with the id of the firing month and the summarized month', () => {
    const result = monthlies(plan({ now: NOW_FRIDAY }));

    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({
      identifier: 'cv.monthly.2026-12',
      kind: 'monthly_summary',
      trigger: { type: 'once', fireAt: local('2026-12-01', 600) },
      content: monthlySummaryContent('2026-11' as never),
    });
    expect(result[0]?.content).toMatchObject({
      month: '2026-11',
      title: 'Tu resumen de noviembre está listo',
    });
    expect(result[11]?.identifier).toBe('cv.monthly.2027-11');
  });

  test('crosses from December to January and names December', () => {
    const january = monthlies(plan({ now: NOW_FRIDAY })).find(
      (n) => n.identifier === 'cv.monthly.2027-01',
    );

    expect(january?.trigger).toEqual({ type: 'once', fireAt: local('2027-01-01', 600) });
    expect(january?.content).toMatchObject({
      month: '2026-12',
      title: 'Tu resumen de diciembre está listo',
    });
  });

  test('includes today on day 1 before 10:00 and skips it afterwards', () => {
    expect(ids(monthlies(plan({ now: local('2026-12-01', 599) })))[0]).toBe('cv.monthly.2026-12');
    expect(ids(monthlies(plan({ now: local('2026-12-01', 600) })))[0]).toBe('cv.monthly.2027-01');
  });

  test('plans none when disabled', () => {
    expect(monthlies(plan({ now: NOW_FRIDAY, preferences: prefs({}, false) }))).toHaveLength(0);
  });
});

describe('planNotifications weekly disabled', () => {
  test.each([false, true])(
    'leaves no weekly reminder, not even the fallback (registered %p)',
    (registered) => {
      const result = plan({
        now: NOW_FRIDAY,
        currentWeekRegistered: registered,
        preferences: prefs({ enabled: false }),
      });

      expect(result.filter((n) => n.kind === 'weekly_reminder')).toHaveLength(0);
      expect(monthlies(result)).toHaveLength(12);
    },
  );

  test('disabling both leaves an empty plan', () => {
    expect(plan({ now: NOW_FRIDAY, preferences: prefs({ enabled: false }, false) })).toEqual([]);
  });
});

describe('planNotifications invariants over a grid', () => {
  const nowsDates = [
    '2026-04-01',
    '2026-04-04',
    '2026-04-05',
    '2026-09-05',
    '2026-09-06',
    '2026-11-09',
    '2026-11-11',
    '2026-11-15',
    '2026-12-31',
    '2027-01-01',
  ];
  const minutes = [0, 599, 600, 1200, 1439];
  const weekdays: IsoWeekday[] = [1, 3, 7];
  const prefMinutes = [0, 600, 1200, 1439];

  const cases: { input: NotificationPlanInput; result: readonly PlannedNotification[] }[] = [];
  for (const day of nowsDates) {
    for (const minute of minutes) {
      for (const weekday of weekdays) {
        for (const minuteOfDay of prefMinutes) {
          for (const registered of [false, true]) {
            const input: NotificationPlanInput = {
              now: local(day, minute),
              calendar,
              preferences: prefs({ weekday, minuteOfDay }),
              currentWeekRegistered: registered,
              lastWeeklyFireAt: null,
              fallbackWeeks: FALLBACK_WEEKS,
              monthsAhead: MONTHS_AHEAD,
            };
            cases.push({ input, result: planNotifications(input) });
          }
        }
      }
    }
  }

  test('never plans an instant in the past and keeps the plan ordered', () => {
    for (const { input, result } of cases) {
      const once = result.filter((n) => n.trigger.type === 'once');
      const times = once.map((n) => fireAtOf(n));
      expect(times.every((time) => time > input.now)).toBe(true);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      if (result.some((n) => n.trigger.type === 'weekly')) {
        expect(result[0]?.identifier).toBe('cv.weekly.repeat');
      }
    }
  });

  test('has deterministic ids, no duplicates and at most 64 pending', () => {
    for (const { result } of cases) {
      expect(new Set(ids(result)).size).toBe(result.length);
      expect(result.length).toBeLessThanOrEqual(MAX_PENDING_NOTIFICATIONS);
      for (const id of ids(result)) {
        expect(id).toMatch(/^cv\.(weekly\.(repeat|\d{4}-\d{2}-\d{2})|monthly\.\d{4}-\d{2})$/);
      }
    }
  });

  test('never has two weekly reminders for the same week (D-13)', () => {
    for (const { input, result } of cases) {
      const repeats = result.filter((n) => n.trigger.type === 'weekly');
      const ones = weeklyOnes(result);
      expect(repeats.length === 1 || ones.length > 0).toBe(true);
      if (repeats.length > 0) {
        expect(ones).toHaveLength(0);
      }
      const currentMonday = isoWeekStart(calendar.localDateOf(input.now));
      const weeks = ones.map((n) => isoWeekStart(calendar.localDateOf(fireAtOf(n))));
      expect(new Set(weeks).size).toBe(weeks.length);
      expect(weeks.every((week) => week >= currentMonday)).toBe(true);
    }
  });

  test('always has a neutral fallback while the weekly reminder is enabled', () => {
    for (const { result } of cases) {
      const fallbacks = result.filter(
        (n) =>
          n.kind === 'weekly_reminder' &&
          n.content.title === weeklyReminderContent('neutral').title,
      );
      expect(fallbacks.length).toBeGreaterThan(0);
    }
  });
});

describe('planNotifications weekly disabled over the same grid', () => {
  test('never yields a weekly reminder', () => {
    for (const registered of [false, true]) {
      const result = plan({
        now: NOW_FRIDAY,
        currentWeekRegistered: registered,
        preferences: prefs({ enabled: false }),
      });
      expect(result.some((n) => n.kind === 'weekly_reminder')).toBe(false);
    }
  });
});

describe('planNotifications calendar time changes', () => {
  const zone = (process.env.TEST_TZ ?? 'America/Santiago') as FixtureTimeZone;
  const fixture = TIME_ZONE_FIXTURES[zone];

  test('Sunday 20:00 stays at 20:00 local across the weeks of both time changes', () => {
    const result = plan({
      now: local('2026-03-30', 720),
      currentWeekRegistered: true,
    });
    const sundays = weeklyOnes(result).filter((n) => {
      const day = calendar.localDateOf(fireAtOf(n));
      return fixture.dstDays.includes(day);
    });

    expect(sundays.length).toBeGreaterThan(0);
    for (const n of sundays) {
      const fireAt = fireAtOf(n);
      const wall = new Date(fireAt);
      expect(wall.getHours() * 60 + wall.getMinutes()).toBe(1200);
      expect(fireAt).toBe(
        calendar.instantAt(calendar.localDateOf(epochMsSchema.parse(fireAt)), 1200),
      );
    }
  });

  test('a reminder at 00:00 on the forward jump day uses the first valid minute', () => {
    const jump = fixture.instantAt.find((c) => c.date === '2026-09-06' && c.minuteOfDay === 0);
    const result = plan({
      now: local('2026-08-31', 720),
      currentWeekRegistered: true,
      preferences: prefs({ weekday: 7, minuteOfDay: 0 }),
    });
    const sunday = result.find((n) => n.identifier === 'cv.weekly.2026-08-31');

    expect(sunday?.trigger).toEqual({ type: 'once', fireAt: local('2026-09-06', 0) });
    expect(new Date(local('2026-09-06', 0)).toISOString().replace('.000Z', 'Z')).toBe(
      jump?.expected,
    );
  });

  test('the monthly summary keeps 10:00 local after the time changes', () => {
    const result = monthlies(plan({ now: local('2026-03-30', 720) }));
    for (const n of result) {
      const wall = new Date(fireAtOf(n));
      expect(wall.getHours() * 60 + wall.getMinutes()).toBe(600);
    }
  });
});

describe('planNotifications at most one weekly reminder per week (D-13)', () => {
  const MONDAY_NEXT = '2026-11-16';
  const WEDNESDAY = local('2026-11-11', 720);
  const mondayFired = local('2026-11-09', 600);
  const friday = prefs({ weekday: 5, minuteOfDay: 1200 });

  const weeklyOf = (items: readonly PlannedNotification[]) =>
    items.filter((n) => n.kind === 'weekly_reminder');

  test.each([
    ['state A', false],
    ['state B', true],
  ])('changing the day after the reminder arrived leaves only the backup (%s)', (_name, reg) => {
    const result = plan({
      now: WEDNESDAY,
      preferences: friday,
      currentWeekRegistered: reg,
      lastWeeklyFireAt: mondayFired,
    });
    const weekly = weeklyOf(result);

    expect(ids(result)).not.toContain('cv.weekly.repeat');
    expect(ids(result)).not.toContain(`cv.weekly.${MONDAY}`);
    expect(weekly).toHaveLength(FALLBACK_WEEKS);
    expect(weekly[0]).toEqual({
      identifier: `cv.weekly.${MONDAY_NEXT}`,
      kind: 'weekly_reminder',
      trigger: { type: 'once', fireAt: local('2026-11-20', 1200) },
      content: weeklyReminderContent('neutral'),
    });
    expect(weekly.every((n) => fireAtOf(n) > local('2026-11-15', 1439))).toBe(true);
  });

  test('a reminder that has not arrived yet is replaced by the new day', () => {
    const result = plan({
      now: WEDNESDAY,
      preferences: friday,
      lastWeeklyFireAt: local('2026-11-12', 600),
    });

    expect(weeklyOf(result)[0]?.trigger).toEqual({ type: 'weekly', weekday: 5, minuteOfDay: 1200 });
  });

  test('a reminder from a previous week does not block this one', () => {
    const result = plan({
      now: WEDNESDAY,
      preferences: friday,
      lastWeeklyFireAt: local('2026-11-02', 600),
    });

    expect(ids(result)).toContain('cv.weekly.repeat');
  });

  test('a reminder that arrives exactly now counts as arrived', () => {
    const result = plan({
      now: mondayFired,
      preferences: prefs({ weekday: 3, minuteOfDay: 1200 }),
      lastWeeklyFireAt: mondayFired,
    });

    expect(ids(result)).not.toContain('cv.weekly.repeat');
    expect(weeklyOf(result)).toHaveLength(FALLBACK_WEEKS);
  });

  test('weekly reminders disabled ignore the stored instant', () => {
    const result = plan({
      now: WEDNESDAY,
      preferences: prefs({ enabled: false }),
      lastWeeklyFireAt: mondayFired,
    });

    expect(weeklyOf(result)).toEqual([]);
  });

  test('never plans two weekly reminders for the same week when the day changes midweek', () => {
    for (const weekday of [1, 2, 3, 4, 5, 6, 7] as const) {
      for (const reg of [false, true]) {
        const preferences = prefs({ weekday });
        const result = plan({
          now: WEDNESDAY,
          preferences,
          currentWeekRegistered: reg,
          lastWeeklyFireAt: mondayFired,
        });
        const thisWeek = weeklyOf(result).filter(
          (n) => n.trigger.type === 'once' && fireAtOf(n) < local(MONDAY_NEXT, 0),
        );
        const instant = weeklyReminderInstant(date('2026-11-11'), preferences.weekly, calendar);

        expect(thisWeek).toEqual([]);
        expect(ids(result).includes('cv.weekly.repeat')).toBe(instant <= WEDNESDAY);
      }
    }
  });
});

describe('weeklyInstantToRemember', () => {
  const base = {
    now: local('2026-11-11', 720),
    calendar,
    preferences: prefs({ weekday: 5, minuteOfDay: 1200 }),
    currentWeekRegistered: false,
    lastWeeklyFireAt: null,
    fallbackWeeks: FALLBACK_WEEKS,
    monthsAhead: MONTHS_AHEAD,
  } satisfies NotificationPlanInput;

  test('is the reminder instant of the current week when it is still ahead', () => {
    expect(weeklyInstantToRemember(base)).toBe(local('2026-11-13', 1200));
  });

  test('is null when the instant already passed, so a missed reminder is not remembered', () => {
    expect(weeklyInstantToRemember({ ...base, now: local('2026-11-14', 0) })).toBeNull();
  });

  test('is null when the reminder of this week already arrived', () => {
    expect(
      weeklyInstantToRemember({ ...base, lastWeeklyFireAt: local('2026-11-09', 600) }),
    ).toBeNull();
  });

  test('is null when the weekly reminder is disabled', () => {
    expect(weeklyInstantToRemember({ ...base, preferences: prefs({ enabled: false }) })).toBeNull();
  });
});
