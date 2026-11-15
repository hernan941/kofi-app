import { epochMsSchema, yearMonthSchema } from '@/shared/domain';

import { diffNotifications, samePlannedNotification } from './diff';
import type { PlannedNotification } from './plan';
import { monthlySummaryContent, weeklyReminderContent } from './texts';

const at = (value: number) => epochMsSchema.parse(value);
const once = (identifier: string, fireAt: number, variant: 'neutral' | 'already_registered') =>
  ({
    identifier,
    kind: 'weekly_reminder',
    trigger: { type: 'once', fireAt: at(fireAt) },
    content: weeklyReminderContent(variant),
  }) satisfies PlannedNotification;
const repeat: PlannedNotification = {
  identifier: 'cv.weekly.repeat',
  kind: 'weekly_reminder',
  trigger: { type: 'weekly', weekday: 7, minuteOfDay: 1200 },
  content: weeklyReminderContent('neutral'),
};
const monthly = (month: string): PlannedNotification => ({
  identifier: 'cv.monthly.2026-12',
  kind: 'monthly_summary',
  trigger: { type: 'once', fireAt: at(5) },
  content: monthlySummaryContent(yearMonthSchema.parse(month)),
});

describe('diffNotifications', () => {
  test('has no operations when nothing changed', () => {
    const plan = [repeat, once('cv.weekly.2026-11-16', 10, 'neutral')];
    expect(diffNotifications(plan, [...plan])).toEqual({ toCancel: [], toSchedule: [] });
  });

  test('schedules what is missing and cancels what is left over', () => {
    const extra = once('cv.weekly.2026-11-23', 20, 'neutral');
    expect(diffNotifications([repeat], [extra])).toEqual({
      toCancel: ['cv.weekly.2026-11-23'],
      toSchedule: [repeat],
    });
  });

  test.each([
    ['trigger', once('cv.weekly.a', 11, 'neutral')],
    ['text', once('cv.weekly.a', 10, 'already_registered')],
  ])('replaces only what differs in %s', (_name, scheduled) => {
    const planned = once('cv.weekly.a', 10, 'neutral');
    const unchanged = once('cv.weekly.b', 10, 'neutral');
    expect(diffNotifications([planned, unchanged], [scheduled, unchanged])).toEqual({
      toCancel: ['cv.weekly.a'],
      toSchedule: [planned],
    });
  });

  test('detects a different month in the monthly payload', () => {
    expect(samePlannedNotification(monthly('2026-11'), monthly('2026-10'))).toBe(false);
    expect(samePlannedNotification(monthly('2026-11'), monthly('2026-11'))).toBe(true);
  });

  test('cancels unrecognized notifications and reschedules them when planned', () => {
    expect(
      diffNotifications([repeat], [{ identifier: 'cv.weekly.repeat', kind: 'unrecognized' }]),
    ).toEqual({ toCancel: ['cv.weekly.repeat'], toSchedule: [repeat] });
    expect(diffNotifications([], [{ identifier: 'cv.old', kind: 'unrecognized' }])).toEqual({
      toCancel: ['cv.old'],
      toSchedule: [],
    });
  });

  test('ignores identifiers without the cv. prefix', () => {
    expect(
      diffNotifications(
        [],
        [
          { identifier: 'cvtest.single.1', kind: 'unrecognized' },
          { ...once('other', 1, 'neutral') },
        ],
      ),
    ).toEqual({ toCancel: [], toSchedule: [] });
  });
});
