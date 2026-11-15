import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from './preferences';
import { summarizeReminders } from './reminder-summary';

const ALL_OFF: NotificationPreferences = {
  weekly: { enabled: false, weekday: 7, minuteOfDay: 1200 },
  monthly: { enabled: false },
};

describe('summarizeReminders', () => {
  it('is loading until both the preferences and the permission are known', () => {
    expect(summarizeReminders(undefined, 'granted')).toEqual({ kind: 'loading' });
    expect(summarizeReminders(DEFAULT_NOTIFICATION_PREFERENCES, undefined)).toEqual({
      kind: 'loading',
    });
  });

  it('reports the phone permission as off when it was denied', () => {
    expect(summarizeReminders(DEFAULT_NOTIFICATION_PREFERENCES, 'denied')).toEqual({
      kind: 'permission_off',
    });
  });

  it('reports a pending permission when the person has not decided', () => {
    expect(summarizeReminders(DEFAULT_NOTIFICATION_PREFERENCES, 'undetermined')).toEqual({
      kind: 'permission_pending',
    });
  });

  it.each(['granted', 'denied', 'undetermined'] as const)(
    'says everything is off first, even with the permission %s',
    (permission) => {
      expect(summarizeReminders(ALL_OFF, permission)).toEqual({ kind: 'all_off' });
    },
  );

  it('describes both reminders when they are on', () => {
    expect(summarizeReminders(DEFAULT_NOTIFICATION_PREFERENCES, 'granted')).toEqual({
      kind: 'on',
      weekly: { weekday: 7, minuteOfDay: 1200 },
      monthly: true,
    });
  });

  it('describes only the weekly reminder', () => {
    const preferences: NotificationPreferences = {
      weekly: { enabled: true, weekday: 2, minuteOfDay: 510 },
      monthly: { enabled: false },
    };

    expect(summarizeReminders(preferences, 'granted')).toEqual({
      kind: 'on',
      weekly: { weekday: 2, minuteOfDay: 510 },
      monthly: false,
    });
  });

  it('describes only the monthly summary with no weekly reminder', () => {
    const preferences: NotificationPreferences = {
      weekly: { enabled: false, weekday: 7, minuteOfDay: 1200 },
      monthly: { enabled: true },
    };

    expect(summarizeReminders(preferences, 'granted')).toEqual({
      kind: 'on',
      weekly: null,
      monthly: true,
    });
  });
});
