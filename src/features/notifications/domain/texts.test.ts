import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';
import { yearMonthSchema } from '@/shared/domain';

import { monthlySummaryContent, weeklyReminderContent } from './texts';

const variants = ['neutral', 'already_registered'] as const;
const months = Array.from({ length: 12 }, (_, i) =>
  yearMonthSchema.parse(`2026-${String(i + 1).padStart(2, '0')}`),
);
const length = (text: string) => Array.from(text).length;

describe('notification texts', () => {
  test('weekly texts are the designed ones', () => {
    expect(weeklyReminderContent('neutral')).toEqual({
      title: '¿Anotamos tus ventas de la semana?',
      body: 'Si esta semana no vendiste, también puedes marcarlo.',
      deepLink: '/sales/new',
    });
    expect(weeklyReminderContent('already_registered')).toEqual({
      title: 'Tu semana ya está anotada',
      body: 'Si hubo alguna venta nueva, puedes sumarla en un momento.',
      deepLink: '/sales/new',
    });
  });

  test('the monthly text names the summarized month and carries it', () => {
    expect(monthlySummaryContent(yearMonthSchema.parse('2026-12'))).toEqual({
      title: 'Tu resumen de diciembre está listo',
      body: 'Toca para ver cómo fue tu mes.',
      deepLink: '/tracking/monthly',
      month: '2026-12',
    });
  });

  test('the neutral text has no data of the week', () => {
    const { title, body } = weeklyReminderContent('neutral');
    expect(`${title} ${body}`).not.toMatch(/[\d$]|semana pasada/);
  });

  test('every text respects the length limits', () => {
    const contents = [...variants.map(weeklyReminderContent), ...months.map(monthlySummaryContent)];
    for (const { title, body } of contents) {
      expect(length(title)).toBeLessThanOrEqual(40);
      expect(length(body)).toBeLessThanOrEqual(60);
    }
  });

  test('no text matches a guilt pattern', () => {
    const contents = [...variants.map(weeklyReminderContent), ...months.map(monthlySummaryContent)];
    for (const { title, body } of contents) {
      expect(findGuiltPattern(title)).toBeNull();
      expect(findGuiltPattern(body)).toBeNull();
    }
  });
});
