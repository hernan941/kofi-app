import { epochMsSchema, yearMonthSchema } from '@/shared/domain';

import { notificationDataSchema, parseNotificationTarget, toNotificationData } from './payload';
import type { PlannedNotification } from './plan';
import { monthlySummaryContent, weeklyReminderContent } from './texts';

const weekly: PlannedNotification = {
  identifier: 'cv.weekly.repeat',
  kind: 'weekly_reminder',
  trigger: { type: 'weekly', weekday: 7, minuteOfDay: 1200 },
  content: weeklyReminderContent('neutral'),
};
const monthly: PlannedNotification = {
  identifier: 'cv.monthly.2026-12',
  kind: 'monthly_summary',
  trigger: { type: 'once', fireAt: epochMsSchema.parse(1_800_000_000_000) },
  content: monthlySummaryContent(yearMonthSchema.parse('2026-11')),
};

describe('notification payload', () => {
  test('round-trips both destinations', () => {
    expect(parseNotificationTarget(toNotificationData(weekly))).toEqual({ deepLink: '/sales/new' });
    expect(parseNotificationTarget(toNotificationData(monthly))).toEqual({
      deepLink: '/tracking/monthly',
      month: '2026-11',
    });
  });

  test('the serialized data satisfies its schema', () => {
    expect(notificationDataSchema.safeParse(toNotificationData(weekly)).success).toBe(true);
    expect(notificationDataSchema.safeParse(toNotificationData(monthly)).success).toBe(true);
  });

  test('tolerates a missing trigger when only the target matters', () => {
    expect(
      parseNotificationTarget({ v: 1, kind: 'weekly_reminder', deepLink: '/sales/new' }),
    ).toEqual({ deepLink: '/sales/new' });
  });

  test.each([
    ['unknown deeplink', { v: 1, kind: 'weekly_reminder', deepLink: '/x' }],
    [
      'invalid month',
      { v: 1, kind: 'monthly_summary', deepLink: '/tracking/monthly', month: '2026-13' },
    ],
    ['missing month', { v: 1, kind: 'monthly_summary', deepLink: '/tracking/monthly' }],
    ['version 2', { v: 2, kind: 'weekly_reminder', deepLink: '/sales/new' }],
    ['null', null],
    ['text', 'hola'],
    ['number', 3],
  ])('rejects %s', (_name, data) => {
    expect(parseNotificationTarget(data)).toBeNull();
  });
});
