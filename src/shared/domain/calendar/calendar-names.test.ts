import { monthName, weekdayName } from './calendar-names';

describe('calendar names', () => {
  test('lists the twelve months in Spanish', () => {
    const names = Array.from({ length: 12 }, (_unused, index) => monthName(index + 1));

    expect(names).toEqual([
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ]);
  });

  test('lists the seven weekdays starting on Monday', () => {
    const names = ([1, 2, 3, 4, 5, 6, 7] as const).map(weekdayName);

    expect(names).toEqual([
      'lunes',
      'martes',
      'miércoles',
      'jueves',
      'viernes',
      'sábado',
      'domingo',
    ]);
  });

  test('rejects a month outside 1 to 12', () => {
    expect(() => monthName(0)).toThrow(RangeError);
    expect(() => monthName(13)).toThrow(RangeError);
  });
});
