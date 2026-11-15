import { isAppNotificationId, TEST_NOTIFICATION_PREFIX } from './identifiers';
import { TEST_NOTIFICATION_IDS, planTestReminder, planTestSequence } from './test-reminder';
import { epochAt } from './testing/planned-fixtures';
import { weeklyReminderContent } from './texts';

const NOW = epochAt(1_700_000_000_000);

describe('planTestReminder', () => {
  it('schedules one notice a minute from now with the text of the variant', () => {
    expect(planTestReminder({ now: NOW, variant: 'already_registered' })).toEqual([
      {
        identifier: 'cvtest.single',
        kind: 'weekly_reminder',
        trigger: { type: 'once', fireAt: epochAt(NOW + 60_000) },
        content: weeklyReminderContent('already_registered'),
      },
    ]);
  });
});

describe('planTestSequence', () => {
  it('imitates state B: adapted text in 1 minute and neutral ones in 3 and 5', () => {
    const plan = planTestSequence({ now: NOW });

    expect(plan.map(({ identifier }) => identifier)).toEqual([
      'cvtest.seq.1',
      'cvtest.seq.2',
      'cvtest.seq.3',
    ]);
    expect(plan.map(({ trigger }) => trigger)).toEqual([
      { type: 'once', fireAt: epochAt(NOW + 60_000) },
      { type: 'once', fireAt: epochAt(NOW + 180_000) },
      { type: 'once', fireAt: epochAt(NOW + 300_000) },
    ]);
    expect(plan.map(({ content }) => content.title)).toEqual([
      weeklyReminderContent('already_registered').title,
      weeklyReminderContent('neutral').title,
      weeklyReminderContent('neutral').title,
    ]);
  });

  it('uses ids the reconciliation never touches', () => {
    for (const planned of [
      ...planTestSequence({ now: NOW }),
      ...planTestReminder({ now: NOW, variant: 'neutral' }),
    ]) {
      expect(planned.identifier.startsWith(TEST_NOTIFICATION_PREFIX)).toBe(true);
      expect(isAppNotificationId(planned.identifier)).toBe(false);
    }
  });
});

describe('TEST_NOTIFICATION_IDS', () => {
  it('lists every id a batch can use, and nothing else', () => {
    const used = [
      ...planTestSequence({ now: NOW }),
      ...planTestReminder({ now: NOW, variant: 'neutral' }),
    ].map(({ identifier }) => identifier);

    expect([...TEST_NOTIFICATION_IDS].sort()).toEqual([...used].sort());
  });
});
