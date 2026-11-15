import { deviceLocalCalendar, epochMsSchema } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';

import { weeklyReminderContent } from '../domain/texts';
import { createFakeNotificationScheduler } from '../testing/fake-notification-scheduler';
import { scheduleTestReminders } from './schedule-test-reminders';

const NOW = epochMsSchema.parse(Date.parse('2026-11-13T15:00:00Z'));

function setup(options: { permission: 'granted' | 'denied'; isRegistered: boolean }) {
  const scheduler = createFakeNotificationScheduler({ permission: options.permission });
  const deps = {
    scheduler,
    weeks: { isRegistered: () => Promise.resolve(options.isRegistered) },
    clock: new FakeClock(NOW),
    calendar: deviceLocalCalendar,
  };
  return { scheduler, deps };
}

describe('scheduleTestReminders', () => {
  it('schedules the neutral text in a minute when the week has no record', async () => {
    const { scheduler, deps } = setup({ permission: 'granted', isRegistered: false });

    await expect(scheduleTestReminders(deps, 'single')).resolves.toBe('scheduled');

    const [scheduled] = scheduler.scheduledNow();
    expect(scheduled?.identifier).toBe('cvtest.single');
    expect(scheduled?.kind === 'weekly_reminder' && scheduled.content.title).toBe(
      weeklyReminderContent('neutral').title,
    );
  });

  it('schedules the adapted text when the week already has a record', async () => {
    const { scheduler, deps } = setup({ permission: 'granted', isRegistered: true });

    await scheduleTestReminders(deps, 'single');

    const [scheduled] = scheduler.scheduledNow();
    expect(scheduled?.kind === 'weekly_reminder' && scheduled.content.title).toBe(
      weeklyReminderContent('already_registered').title,
    );
  });

  it('schedules the three notices of the state B sequence', async () => {
    const { scheduler, deps } = setup({ permission: 'granted', isRegistered: false });

    await scheduleTestReminders(deps, 'sequence');

    expect(scheduler.scheduledNow().map(({ identifier }) => identifier)).toEqual([
      'cvtest.seq.1',
      'cvtest.seq.2',
      'cvtest.seq.3',
    ]);
  });

  it('schedules nothing without the permission', async () => {
    const { scheduler, deps } = setup({ permission: 'denied', isRegistered: true });

    await expect(scheduleTestReminders(deps, 'single')).resolves.toBe('no_permission');

    expect(scheduler.scheduledNow()).toEqual([]);
  });

  it.each([
    ['single', 'sequence'],
    ['sequence', 'single'],
    ['single', 'single'],
    ['sequence', 'sequence'],
  ] as const)('keeps one batch at a time: %s then %s', async (first, second) => {
    const { scheduler, deps } = setup({ permission: 'granted', isRegistered: false });

    await scheduleTestReminders(deps, first);
    await scheduleTestReminders(deps, second);

    expect(scheduler.scheduledNow()).toHaveLength(second === 'single' ? 1 : 3);
  });
});
