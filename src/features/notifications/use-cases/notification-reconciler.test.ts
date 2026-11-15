import { createDataChanges } from '@/core/db/data-changes';
import { createInMemoryNoSalesWeekRepository } from '@/features/sales/testing/in-memory-no-sales-week-repository';
import { createInMemorySaleRepository } from '@/features/sales/testing/in-memory-sale-repository';
import { deviceLocalCalendar, epochMsSchema } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { createFakeNotificationScheduler } from '../testing/fake-notification-scheduler';
import { createInMemoryPreferencesRepository } from '../testing/in-memory-preferences-repository';
import { createNotificationReconciler } from './notification-reconciler';
import { reconcileNotifications, type ReconcileSummary } from './reconcile-notifications';
import { createRegisteredWeekReader } from './registered-week-reader';

const NOW = epochMsSchema.parse(Date.parse('2026-11-13T15:00:00Z'));
const SUMMARY: ReconcileSummary = { state: 'A', cancelled: 0, scheduled: 0 };

/** Lets every pending promise callback run. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) {
    await Promise.resolve();
  }
}

/** A `run` whose executions finish only when the test says so. */
function controlledRun() {
  const gates: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const run = jest.fn(
    () =>
      new Promise<ReconcileSummary>((resolve, reject) => {
        gates.push({
          resolve: () => {
            resolve(SUMMARY);
          },
          reject,
        });
      }),
  );
  return { run, gates };
}

describe('createNotificationReconciler', () => {
  it('starts right away when idle', async () => {
    const { run, gates } = controlledRun();
    const reconciler = createNotificationReconciler(run, new RecordingLogger());

    const done = reconciler.request();
    expect(run).toHaveBeenCalledTimes(1);
    gates[0]?.resolve();

    await expect(done).resolves.toBeUndefined();
  });

  it('turns three simultaneous requests into one running and one later execution', async () => {
    const { run, gates } = controlledRun();
    const reconciler = createNotificationReconciler(run, new RecordingLogger());

    const all = Promise.all([reconciler.request(), reconciler.request(), reconciler.request()]);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);

    gates[0]?.resolve();
    await settle();
    expect(run).toHaveBeenCalledTimes(2);

    gates[1]?.resolve();
    await all;
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('resolves a request made during a run only after a run that started after it', async () => {
    const { run, gates } = controlledRun();
    const reconciler = createNotificationReconciler(run, new RecordingLogger());
    void reconciler.request();
    let lateDone = false;
    const late = reconciler.request().then(() => {
      lateDone = true;
    });

    gates[0]?.resolve();
    await settle();
    expect(lateDone).toBe(false);

    gates[1]?.resolve();
    await late;
    expect(lateDone).toBe(true);
  });

  it('never runs two executions at once when a request arrives from the first one continuation', async () => {
    let active = 0;
    let maxActive = 0;
    const gates: (() => void)[] = [];
    const run = jest.fn(
      () =>
        new Promise<ReconcileSummary>((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          gates.push(() => {
            active -= 1;
            resolve(SUMMARY);
          });
        }),
    );
    const reconciler = createNotificationReconciler(run, new RecordingLogger());

    const first = reconciler.request();
    void first.then(() => reconciler.request());
    void reconciler.request();
    for (let released = 0; released < 3; released += 1) {
      gates[released]?.();
      await settle();
    }

    expect(maxActive).toBe(1);
  });

  it('can start another pair of executions after the queue drains', async () => {
    const { run, gates } = controlledRun();
    const reconciler = createNotificationReconciler(run, new RecordingLogger());
    const first = reconciler.request();
    gates[0]?.resolve();
    await first;

    const second = reconciler.request();
    expect(run).toHaveBeenCalledTimes(2);
    gates[1]?.resolve();
    await second;
  });

  it('logs a failed execution, never rejects and keeps the queue working', async () => {
    const { run, gates } = controlledRun();
    const logger = new RecordingLogger();
    const reconciler = createNotificationReconciler(run, logger);

    const failing = reconciler.request();
    const queued = reconciler.request();
    gates[0]?.reject(new Error('boom'));
    await expect(failing).resolves.toBeUndefined();
    await settle();
    gates[1]?.resolve();

    await expect(queued).resolves.toBeUndefined();
    expect(logger.entriesAt('error').map(({ event }) => event)).toEqual([
      'notifications_reconcile_failed',
    ]);
    const next = reconciler.request();
    gates[2]?.resolve();
    await next;
    expect(run).toHaveBeenCalledTimes(3);
  });

  describe('with a slow scheduler', () => {
    function setup() {
      const logger = new RecordingLogger();
      const dataChanges = createDataChanges(logger);
      const scheduler = createFakeNotificationScheduler({ permission: 'granted', isSlow: true });
      const preferences = createInMemoryPreferencesRepository({ dataChanges });
      const weeks = createRegisteredWeekReader({
        sales: createInMemorySaleRepository({ dataChanges }),
        noSalesWeeks: createInMemoryNoSalesWeekRepository({ dataChanges }),
      });
      const reconciler = createNotificationReconciler(
        () =>
          reconcileNotifications({
            scheduler,
            preferences,
            weeks,
            clock: new FakeClock(NOW),
            calendar: deviceLocalCalendar,
            logger,
          }),
        logger,
      );
      return { scheduler, preferences, reconciler, logger };
    }

    async function drain(scheduler: ReturnType<typeof setup>['scheduler'], done: Promise<unknown>) {
      const state = { finished: false };
      void done.then(() => {
        state.finished = true;
      });
      while (!state.finished) {
        await settle();
        scheduler.releaseAll();
      }
    }

    it('never interleaves the operations of two executions', async () => {
      const { scheduler, reconciler } = setup();

      await drain(
        scheduler,
        Promise.all([reconciler.request(), reconciler.request(), reconciler.request()]),
      );

      expect(scheduler.operations.map(({ type }) => type)).toEqual([
        'permission',
        'list',
        'schedule',
        'permission',
        'list',
      ]);
    });

    it('lets the last execution use the latest preferences', async () => {
      const { scheduler, preferences, reconciler } = setup();
      const first = reconciler.request();
      await settle();

      await preferences.save(
        { weekly: { enabled: false, weekday: 7, minuteOfDay: 1200 }, monthly: { enabled: true } },
        NOW,
      );
      const second = reconciler.request();
      await drain(scheduler, Promise.all([first, second]));

      const scheduled = scheduler.scheduledNow().map(({ identifier }) => identifier);
      expect(scheduled).not.toContain('cv.weekly.repeat');
      expect(scheduled.every((id) => id.startsWith('cv.monthly.'))).toBe(true);
    });

    it('does not get stuck when the scheduler fails in the middle of an execution', async () => {
      const { scheduler, reconciler, logger } = setup();
      scheduler.failNext('list');

      await drain(scheduler, reconciler.request());
      await drain(scheduler, reconciler.request());

      expect(logger.entriesAt('error')).toHaveLength(1);
      expect(scheduler.scheduledNow().length).toBeGreaterThan(0);
    });
  });
});
