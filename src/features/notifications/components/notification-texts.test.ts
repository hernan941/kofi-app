import type { IsoWeekday } from '@/shared/domain';

import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import type { ReminderSummary } from '../domain/reminder-summary';
import { formatReminderTime, reminderSummaryText, weekdayPlural } from './notification-texts';

describe('weekdayPlural', () => {
  it.each([
    [1, 'los lunes'],
    [2, 'los martes'],
    [3, 'los miércoles'],
    [4, 'los jueves'],
    [5, 'los viernes'],
    [6, 'los sábados'],
    [7, 'los domingos'],
  ] as const)('writes weekday %i as "%s"', (weekday: IsoWeekday, expected: string) => {
    expect(weekdayPlural(weekday)).toBe(expected);
  });

  it.each([
    [1, 'Lunes'],
    [3, 'Miércoles'],
    [6, 'Sábados'],
    [7, 'Domingos'],
  ] as const)('capitalizes weekday %i as "%s" without the article', (weekday, expected) => {
    expect(weekdayPlural(weekday, { capitalized: true })).toBe(expected);
  });
});

describe('formatReminderTime', () => {
  it.each([
    [0, '0:00'],
    [15, '0:15'],
    [510, '8:30'],
    [1200, '20:00'],
    [1439, '23:59'],
  ])('formats minute %i of the day as "%s"', (minuteOfDay, expected) => {
    expect(formatReminderTime(minuteOfDay)).toBe(expected);
  });
});

describe('reminderSummaryText', () => {
  const cases: readonly (readonly [ReminderSummary, string | null])[] = [
    [{ kind: 'loading' }, null],
    [{ kind: 'permission_off' }, 'Los avisos están apagados en tu teléfono'],
    [{ kind: 'permission_pending' }, 'Los avisos están sin activar'],
    [{ kind: 'all_off' }, 'Apagados'],
    [
      { kind: 'on', weekly: { weekday: 7, minuteOfDay: 1200 }, monthly: true },
      'Domingos a las 20:00 y resumen del mes',
    ],
    [{ kind: 'on', weekly: { weekday: 2, minuteOfDay: 510 }, monthly: false }, 'Martes a las 8:30'],
    [{ kind: 'on', weekly: null, monthly: true }, 'Solo el resumen del mes'],
  ];

  it.each(cases)('writes %j as %j', (summary, expected) => {
    expect(reminderSummaryText(summary)).toBe(expected);
  });

  it('never blames the person', () => {
    for (const [summary] of cases) {
      const text = reminderSummaryText(summary);
      if (text !== null) {
        expect(findGuiltPattern(text)).toBeNull();
      }
    }
  });
});
