import type { CalendarDay } from '../domain';
import { clp, day } from '../domain/testing/tracking-fixtures';
import { dayAccessibilityLabel } from './day-label';

function calendarDay(overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: day('2026-11-12'),
    inMonth: true,
    isToday: false,
    isFuture: false,
    activity: null,
    level: 0,
    ...overrides,
  };
}

describe('dayAccessibilityLabel', () => {
  it('says the date, the amount and the number of sales', () => {
    expect(
      dayAccessibilityLabel(
        calendarDay({
          activity: { date: day('2026-11-12'), total: clp(45000), recordCount: 2 },
          level: 3,
        }),
        false,
      ),
    ).toBe('12 de noviembre, 45.000 pesos, 2 ventas');
  });

  it('uses the singular for one sale', () => {
    expect(
      dayAccessibilityLabel(
        calendarDay({
          activity: { date: day('2026-11-12'), total: clp(1), recordCount: 1 },
          level: 3,
        }),
        false,
      ),
    ).toBe('12 de noviembre, 1 peso, 1 venta');
  });

  it('says there were no sales', () => {
    expect(dayAccessibilityLabel(calendarDay(), false)).toBe('12 de noviembre, sin ventas');
  });

  it('starts with "Hoy," on the current day', () => {
    expect(dayAccessibilityLabel(calendarDay({ isToday: true }), false)).toBe(
      'Hoy, 12 de noviembre, sin ventas',
    );
  });

  it('adds that the week was marked', () => {
    expect(dayAccessibilityLabel(calendarDay(), true)).toBe(
      '12 de noviembre, sin ventas, semana marcada como no vendí',
    );
  });

  it('says a future day is not available', () => {
    expect(dayAccessibilityLabel(calendarDay({ isFuture: true }), true)).toBe(
      '12 de noviembre, no disponible',
    );
  });
});
