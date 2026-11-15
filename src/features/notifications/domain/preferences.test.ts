import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  MINUTES_PER_DAY,
  notificationPreferencesSchema,
} from './preferences';

const valid = {
  weekly: { enabled: true, weekday: 7, minuteOfDay: 1200 },
  monthly: { enabled: true },
};

describe('notification preferences', () => {
  test('default to Sunday at 20:00 with the monthly summary on', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual(valid);
    expect(MINUTES_PER_DAY).toBe(1440);
  });

  test('the defaults satisfy the schema', () => {
    expect(notificationPreferencesSchema.safeParse(DEFAULT_NOTIFICATION_PREFERENCES).success).toBe(
      true,
    );
  });

  test.each([0, 8, 1.5, -1])('rejects weekday %p', (weekday) => {
    const result = notificationPreferencesSchema.safeParse({
      ...valid,
      weekly: { ...valid.weekly, weekday },
    });
    expect(result.success).toBe(false);
  });

  test.each([-1, 1440, 12.5])('rejects minuteOfDay %p', (minuteOfDay) => {
    const result = notificationPreferencesSchema.safeParse({
      ...valid,
      weekly: { ...valid.weekly, minuteOfDay },
    });
    expect(result.success).toBe(false);
  });

  test.each([1, 7])('accepts weekday %p and the minute bounds', (weekday) => {
    for (const minuteOfDay of [0, 1439]) {
      expect(
        notificationPreferencesSchema.safeParse({
          ...valid,
          weekly: { ...valid.weekly, weekday, minuteOfDay },
        }).success,
      ).toBe(true);
    }
  });
});
