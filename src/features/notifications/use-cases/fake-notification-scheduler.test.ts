import { plannedWeeklyOnce } from '../domain/testing/planned-fixtures';
import { createFakeNotificationScheduler } from '../testing/fake-notification-scheduler';

describe('FakeNotificationScheduler', () => {
  it('keeps what is scheduled and logs every operation in order', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'granted' });
    const planned = plannedWeeklyOnce('cv.weekly.a', 1);

    await scheduler.schedule([planned]);
    await expect(scheduler.listScheduled()).resolves.toEqual([planned]);
    await scheduler.cancel(['cv.weekly.a']);

    await expect(scheduler.listScheduled()).resolves.toEqual([]);
    expect(scheduler.operations).toEqual([
      { type: 'schedule', identifiers: ['cv.weekly.a'] },
      { type: 'list' },
      { type: 'cancel', identifiers: ['cv.weekly.a'] },
      { type: 'list' },
    ]);
  });

  it('answers the permission it was configured with and changes it when requested', async () => {
    const scheduler = createFakeNotificationScheduler({
      permission: 'undetermined',
      requestResult: 'granted',
    });

    await expect(scheduler.getPermission()).resolves.toBe('undetermined');
    await expect(scheduler.requestPermission()).resolves.toBe('granted');
    await expect(scheduler.getPermission()).resolves.toBe('granted');
    expect(scheduler.requestCount).toBe(1);
  });

  it('can be made to fail once and then recovers', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'granted' });
    scheduler.failNext('list');

    await expect(scheduler.listScheduled()).rejects.toThrow('fake scheduler failure');
    await expect(scheduler.listScheduled()).resolves.toEqual([]);
  });

  it('holds each operation until released when slow', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'granted', isSlow: true });
    let done = false;
    const pending = scheduler.cancel(['cv.a']).then(() => {
      done = true;
    });

    await Promise.resolve();
    expect(done).toBe(false);
    expect(scheduler.pendingCount).toBe(1);
    scheduler.releaseAll();
    await pending;

    expect(done).toBe(true);
  });
});
