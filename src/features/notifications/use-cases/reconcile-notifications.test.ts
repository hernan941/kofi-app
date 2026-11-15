import { createDataChanges } from '@/core/db/data-changes';
import { createInMemoryNoSalesWeekRepository } from '@/features/sales/testing/in-memory-no-sales-week-repository';
import { createInMemorySaleRepository } from '@/features/sales/testing/in-memory-sale-repository';
import { date, makeSaleItem, makeSaleRecord } from '../../sales/domain/testing/sale-fixtures';
import { deviceLocalCalendar, epochMsSchema } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { createInMemoryPreferencesRepository } from '../testing/in-memory-preferences-repository';
import { plannedWeeklyOnce } from '../domain/testing/planned-fixtures';
import { createFakeNotificationScheduler } from '../testing/fake-notification-scheduler';
import { reconcileNotifications } from './reconcile-notifications';
import { createRegisteredWeekReader } from './registered-week-reader';

const FRIDAY = epochMsSchema.parse(Date.parse('2026-11-13T15:00:00Z'));

type FakeScheduler = ReturnType<typeof createFakeNotificationScheduler>;

function setup(
  scheduler: FakeScheduler = createFakeNotificationScheduler({ permission: 'granted' }),
) {
  const logger = new RecordingLogger();
  const dataChanges = createDataChanges(logger);
  const preferences = createInMemoryPreferencesRepository({ dataChanges });
  const sales = createInMemorySaleRepository({ dataChanges });
  const noSalesWeeks = createInMemoryNoSalesWeekRepository({ dataChanges });
  const weeks = createRegisteredWeekReader({ sales, noSalesWeeks });
  const deps = {
    scheduler,
    preferences,
    weeks,
    clock: new FakeClock(FRIDAY),
    calendar: deviceLocalCalendar,
    logger,
  };
  const registerThisWeek = () => {
    sales.saveSync(makeSaleRecord([makeSaleItem(1)], { soldOn: date('2026-11-11') }));
  };
  return { deps, scheduler, preferences, logger, registerThisWeek, clock: deps.clock };
}

function ids(scheduler: FakeScheduler): string[] {
  return scheduler.scheduledNow().map(({ identifier }) => identifier);
}

function mutations(scheduler: FakeScheduler) {
  return scheduler.operations.filter(({ type }) => type === 'cancel' || type === 'schedule');
}

describe('reconcileNotifications', () => {
  it('cancels everything of the app and schedules nothing without permission', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'denied' });
    scheduler.seed([
      plannedWeeklyOnce('cv.weekly.2026-11-09', 1),
      plannedWeeklyOnce('cvtest.x', 1),
    ]);
    const { deps } = setup(scheduler);

    const summary = await reconcileNotifications(deps);

    expect(summary).toEqual({ state: 'no_permission', cancelled: 1, scheduled: 0 });
    expect(ids(scheduler)).toEqual(['cvtest.x']);
  });

  it('does not read preferences or the week without permission', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'undetermined' });
    const { deps } = setup(scheduler);
    const getPreferences = jest.spyOn(deps.preferences, 'get');

    await reconcileNotifications(deps);

    expect(getPreferences).not.toHaveBeenCalled();
    expect(mutations(scheduler)).toEqual([]);
  });

  it('state A: schedules the neutral repeat and the 12 monthly summaries', async () => {
    const { deps, scheduler } = setup();

    const summary = await reconcileNotifications(deps);

    expect(summary).toEqual({ state: 'A', cancelled: 0, scheduled: 13 });
    expect(ids(scheduler)).toContain('cv.weekly.repeat');
    expect(ids(scheduler).filter((id) => id.startsWith('cv.monthly.'))).toHaveLength(12);
  });

  it('state B: replaces the repeat with the adapted notice and 47 neutral ones', async () => {
    const { deps, scheduler, registerThisWeek } = setup();
    registerThisWeek();

    const summary = await reconcileNotifications(deps);

    expect(summary.state).toBe('B');
    expect(ids(scheduler)).not.toContain('cv.weekly.repeat');
    expect(ids(scheduler).filter((id) => id.startsWith('cv.weekly.'))).toHaveLength(48);
  });

  it('always cancels before it schedules when moving from A to B', async () => {
    const { deps, scheduler, registerThisWeek } = setup();
    await reconcileNotifications(deps);
    registerThisWeek();
    scheduler.clearOperations();

    await reconcileNotifications(deps);

    expect(mutations(scheduler).map(({ type }) => type)).toEqual(['cancel', 'schedule']);
    expect(mutations(scheduler)[0]).toEqual({ type: 'cancel', identifiers: ['cv.weekly.repeat'] });
  });

  it('is idempotent: a second run changes nothing', async () => {
    const { deps, scheduler } = setup();
    await reconcileNotifications(deps);
    scheduler.clearOperations();

    const summary = await reconcileNotifications(deps);

    expect(summary).toEqual({ state: 'A', cancelled: 0, scheduled: 0 });
    expect(mutations(scheduler)).toEqual([]);
  });

  it('with the weekly reminder off keeps only the monthly summaries and skips the week lookup', async () => {
    const { deps, scheduler, preferences } = setup();
    await preferences.save(
      { weekly: { enabled: false, weekday: 7, minuteOfDay: 1200 }, monthly: { enabled: true } },
      FRIDAY,
    );
    const isRegistered = jest.spyOn(deps.weeks, 'isRegistered');

    const summary = await reconcileNotifications(deps);

    expect(summary.state).toBe('weekly_off');
    expect(ids(scheduler).every((id) => id.startsWith('cv.monthly.'))).toBe(true);
    expect(isRegistered).not.toHaveBeenCalled();
  });

  it('leaves the test notifications alone', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'granted' });
    scheduler.seed([plannedWeeklyOnce('cvtest.single.1', 1)]);
    const { deps } = setup(scheduler);

    await reconcileNotifications(deps);

    expect(ids(scheduler)).toContain('cvtest.single.1');
  });

  it('logs only counts and the state, never business data', async () => {
    const { deps, logger } = setup();

    await reconcileNotifications(deps);

    expect(logger.entries).toContainEqual({
      level: 'info',
      event: 'notifications_reconciled',
      context: { state: 'A', cancelled: 0, scheduled: 13 },
    });
  });

  it('rejects when the scheduler fails, so the queue can log it', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'granted' });
    scheduler.failNext('list');
    const { deps } = setup(scheduler);

    await expect(reconcileNotifications(deps)).rejects.toThrow('fake scheduler failure');
  });

  describe('one weekly reminder per week (D-13)', () => {
    const at = (day: string, minuteOfDay: number) =>
      deviceLocalCalendar.instantAt(date(day), minuteOfDay);
    const weekly = (weekday: 1 | 5 | 7, minuteOfDay = 600) => ({
      weekly: { enabled: true, weekday, minuteOfDay },
      monthly: { enabled: true },
    });

    it('remembers the reminder instant of the current week after scheduling', async () => {
      const { deps, preferences } = setup();

      await reconcileNotifications(deps);

      await expect(preferences.getLastWeeklyFireAt()).resolves.toBe(at('2026-11-15', 1200));
    });

    it.each([
      ['state A', false],
      ['state B', true],
    ])(
      'keeps only the backup when the day changes after the reminder arrived (%s)',
      async (_n, registered) => {
        const { deps, scheduler, preferences, clock, registerThisWeek } = setup();
        clock.set(at('2026-11-09', 480));
        await preferences.save(weekly(1), clock.now());
        await reconcileNotifications(deps);
        clock.set(at('2026-11-11', 720));
        if (registered) {
          registerThisWeek();
        }
        await preferences.save(weekly(5), clock.now());

        await reconcileNotifications(deps);

        expect(ids(scheduler)).not.toContain('cv.weekly.repeat');
        expect(ids(scheduler)).not.toContain('cv.weekly.2026-11-09');
        expect(ids(scheduler)).toContain('cv.weekly.2026-11-16');
        await expect(preferences.getLastWeeklyFireAt()).resolves.toBe(at('2026-11-09', 600));
      },
    );

    it('forgets the instant when the weekly reminder is turned off', async () => {
      const { deps, preferences, clock } = setup();
      await reconcileNotifications(deps);
      await preferences.save(
        { weekly: { enabled: false, weekday: 7, minuteOfDay: 1200 }, monthly: { enabled: true } },
        clock.now(),
      );

      await reconcileNotifications(deps);

      await expect(preferences.getLastWeeklyFireAt()).resolves.toBeNull();
    });

    it('does not touch the instant without permission', async () => {
      const { deps, preferences } = setup();
      await reconcileNotifications(deps);
      const denied = createFakeNotificationScheduler({ permission: 'denied' });

      await reconcileNotifications({ ...deps, scheduler: denied });

      await expect(preferences.getLastWeeklyFireAt()).resolves.toBe(at('2026-11-15', 1200));
    });

    it('does not remember an instant when scheduling fails', async () => {
      const scheduler = createFakeNotificationScheduler({ permission: 'granted' });
      scheduler.failNext('schedule');
      const { deps, preferences } = setup(scheduler);

      await expect(reconcileNotifications(deps)).rejects.toThrow();

      await expect(preferences.getLastWeeklyFireAt()).resolves.toBeNull();
    });
  });
});
