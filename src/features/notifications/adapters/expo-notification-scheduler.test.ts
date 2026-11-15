import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { epochMsSchema, deviceLocalCalendar } from '@/shared/domain';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  FALLBACK_WEEKS,
  MONTHS_AHEAD,
  diffNotifications,
  planNotifications,
  toNotificationData,
} from '../domain';
import {
  plannedMonthly,
  plannedWeeklyOnce,
  plannedWeeklyRepeat,
} from '../domain/testing/planned-fixtures';
import { createExpoNotificationScheduler } from './expo-notification-scheduler';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

const mocked = jest.mocked(Notifications);

function status(value: string, ios?: number) {
  return {
    status: value,
    granted: value === 'granted',
    canAskAgain: value !== 'denied',
    expires: 'never',
    ...(ios === undefined ? {} : { ios: { status: ios } }),
  } as never;
}

function useOs(os: 'android' | 'ios') {
  jest.replaceProperty(Platform, 'OS', os);
}

beforeEach(() => {
  mocked.setNotificationChannelAsync.mockResolvedValue(null);
  mocked.getPermissionsAsync.mockResolvedValue(status('undetermined'));
  mocked.requestPermissionsAsync.mockResolvedValue(status('granted'));
  mocked.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  mocked.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
  mocked.scheduleNotificationAsync.mockResolvedValue('id');
});

describe('permissions', () => {
  it('creates the Android channel before asking for permission, once per process', async () => {
    useOs('android');
    const order: string[] = [];
    mocked.setNotificationChannelAsync.mockImplementation(() => {
      order.push('channel');
      return Promise.resolve(null);
    });
    mocked.requestPermissionsAsync.mockImplementation(() => {
      order.push('permission');
      return Promise.resolve(status('granted'));
    });
    const scheduler = createExpoNotificationScheduler();

    await scheduler.requestPermission();
    await scheduler.requestPermission();

    expect(order).toEqual(['channel', 'permission', 'permission']);
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith('reminders', {
      name: 'Recordatorios',
      description: 'Recordatorio semanal y resumen del mes',
      importance: 5,
    });
  });

  it('retries the channel after a failure instead of caching it', async () => {
    useOs('android');
    mocked.setNotificationChannelAsync.mockRejectedValueOnce(new Error('boom'));
    const scheduler = createExpoNotificationScheduler();

    await expect(scheduler.requestPermission()).rejects.toThrow('boom');
    await expect(scheduler.requestPermission()).resolves.toBe('granted');
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
  });

  it('asks iOS for alert and sound, without badge or provisional, and no channel', async () => {
    useOs('ios');

    await createExpoNotificationScheduler().requestPermission();

    expect(mocked.requestPermissionsAsync).toHaveBeenCalledWith({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['granted', undefined, 'granted'],
    ['denied', undefined, 'denied'],
    ['undetermined', undefined, 'undetermined'],
    ['denied', 3, 'granted'],
    ['denied', 4, 'granted'],
  ] as const)('maps %s (iOS status %s) to %s', async (value, ios, expected) => {
    mocked.getPermissionsAsync.mockResolvedValue(status(value, ios));

    await expect(createExpoNotificationScheduler().getPermission()).resolves.toBe(expected);
  });

  it('reads an Android permission that was never asked as undetermined, not as denied', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: true,
      expires: 'never',
    } as never);

    await expect(createExpoNotificationScheduler().getPermission()).resolves.toBe('undetermined');
  });

  it('maps the result of requesting the permission', async () => {
    useOs('ios');
    mocked.requestPermissionsAsync.mockResolvedValue(status('denied'));

    await expect(createExpoNotificationScheduler().requestPermission()).resolves.toBe('denied');
  });

  it('does not create the channel when only reading the permission', async () => {
    useOs('android');

    await createExpoNotificationScheduler().getPermission();

    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});

describe('schedule', () => {
  it('uses a DATE trigger on the reminders channel for one-off notifications', async () => {
    useOs('android');
    const planned = plannedWeeklyOnce('cv.weekly.2026-11-16', 5_000, 'already_registered');

    await createExpoNotificationScheduler().schedule([planned]);

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'cv.weekly.2026-11-16',
      content: {
        title: planned.content.title,
        body: planned.content.body,
        data: toNotificationData(planned),
        sound: 'default',
      },
      trigger: { type: 'date', date: 5_000, channelId: 'reminders' },
    });
  });

  it('uses a WEEKLY trigger with the Expo weekday for the neutral repeat (Sunday is 1)', async () => {
    useOs('android');

    await createExpoNotificationScheduler().schedule([plannedWeeklyRepeat()]);

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'cv.weekly.repeat',
        trigger: { type: 'weekly', weekday: 1, hour: 20, minute: 0, channelId: 'reminders' },
      }),
    );
  });

  it('schedules in order, one at a time, after making sure the channel exists', async () => {
    useOs('android');
    const order: string[] = [];
    mocked.setNotificationChannelAsync.mockImplementation(() => {
      order.push('channel');
      return Promise.resolve(null);
    });
    mocked.scheduleNotificationAsync.mockImplementation(({ identifier }) => {
      order.push(identifier ?? '?');
      return Promise.resolve('id');
    });

    await createExpoNotificationScheduler().schedule([
      plannedWeeklyOnce('cv.weekly.a', 1),
      plannedMonthly('2026-12', '2026-11'),
    ]);

    expect(order).toEqual(['channel', 'cv.weekly.a', 'cv.monthly.2026-12']);
  });
});

describe('listScheduled and cancel', () => {
  it('returns only cv. notifications rebuilt from their payload', async () => {
    const weekly = plannedWeeklyOnce('cv.weekly.2026-11-16', 7_000, 'already_registered');
    const monthly = plannedMonthly('2026-12', '2026-11', 9_000);
    const repeat = plannedWeeklyRepeat();
    const request = (planned: typeof weekly) => ({
      identifier: planned.identifier,
      content: {
        title: planned.content.title,
        body: planned.content.body,
        data: toNotificationData(planned),
      },
      trigger: null,
    });
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      request(weekly),
      request(monthly),
      request(repeat),
      { ...request(weekly), identifier: 'cvtest.single.1' },
      { ...request(weekly), identifier: 'other.1' },
    ] as never);

    await expect(createExpoNotificationScheduler().listScheduled()).resolves.toEqual([
      weekly,
      monthly,
      repeat,
    ]);
  });

  it.each([
    ['unreadable data', { v: 7 }],
    ['missing data', undefined],
    [
      'a weekly trigger on a monthly summary',
      {
        v: 1,
        kind: 'monthly_summary',
        deepLink: '/tracking/monthly',
        month: '2026-11',
        trigger: { type: 'weekly', weekday: 1, minuteOfDay: 0 },
      },
    ],
  ])('marks %s as unrecognized so it gets cancelled', async (_name, data) => {
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'cv.weekly.old', content: { title: 'a', body: 'b', data }, trigger: null },
    ] as never);

    await expect(createExpoNotificationScheduler().listScheduled()).resolves.toEqual([
      { identifier: 'cv.weekly.old', kind: 'unrecognized' },
    ]);
  });

  it('marks a notification without text as unrecognized', async () => {
    const weekly = plannedWeeklyOnce('cv.weekly.2026-11-16', 7_000);
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue([
      {
        identifier: weekly.identifier,
        content: { title: null, body: null, data: toNotificationData(weekly) },
        trigger: null,
      },
    ] as never);

    await expect(createExpoNotificationScheduler().listScheduled()).resolves.toEqual([
      { identifier: weekly.identifier, kind: 'unrecognized' },
    ]);
  });

  it('cancels each identifier', async () => {
    await createExpoNotificationScheduler().cancel(['cv.a', 'cv.b']);

    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('cv.a');
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith('cv.b');
  });
});

describe('round trip with the diff', () => {
  const now = epochMsSchema.parse(Date.parse('2026-11-13T15:00:00Z'));

  it.each([
    ['state A', false],
    ['state B', true],
  ])('plan -> adapter -> diffNotifications has no operations (%s)', async (_name, registered) => {
    const plan = planNotifications({
      now,
      calendar: deviceLocalCalendar,
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      currentWeekRegistered: registered,
      lastWeeklyFireAt: null,
      fallbackWeeks: FALLBACK_WEEKS,
      monthsAhead: MONTHS_AHEAD,
    });
    const scheduler = createExpoNotificationScheduler();
    await scheduler.schedule(plan);
    const stored = mocked.scheduleNotificationAsync.mock.calls.map(([request]) => ({
      identifier: request.identifier ?? '',
      content: request.content,
      trigger: null,
    }));
    mocked.getAllScheduledNotificationsAsync.mockResolvedValue(stored as never);

    const scheduled = await scheduler.listScheduled();

    expect(diffNotifications(plan, scheduled)).toEqual({ toCancel: [], toSchedule: [] });
  });
});
