import { localDateSchema, yearMonthSchema } from '@/shared/domain';

import {
  APP_NOTIFICATION_PREFIX,
  TEST_NOTIFICATION_PREFIX,
  isAppNotificationId,
  monthlyId,
  weeklyOnceId,
  weeklyRepeatId,
} from './identifiers';

describe('notification identifiers', () => {
  test('are deterministic', () => {
    expect(weeklyRepeatId()).toBe('cv.weekly.repeat');
    expect(weeklyOnceId(localDateSchema.parse('2026-11-09'))).toBe('cv.weekly.2026-11-09');
    expect(monthlyId(yearMonthSchema.parse('2026-12'))).toBe('cv.monthly.2026-12');
  });

  test('recognizes only ids with the app prefix', () => {
    expect(APP_NOTIFICATION_PREFIX).toBe('cv.');
    expect(TEST_NOTIFICATION_PREFIX).toBe('cvtest.');
    expect(isAppNotificationId('cv.weekly.repeat')).toBe(true);
    expect(isAppNotificationId('cvtest.single.1')).toBe(false);
    expect(isAppNotificationId('other')).toBe(false);
  });
});
