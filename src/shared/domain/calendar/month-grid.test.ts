import { monthGrid, monthGridRange } from './month-grid';
import { yearMonthSchema } from './year-month';

const month = (text: string) => yearMonthSchema.parse(text);

describe('monthGrid', () => {
  test('lays out November 2026 in Monday-to-Sunday rows, padding with null', () => {
    const grid = monthGrid(month('2026-11'));

    expect(grid).toHaveLength(6);
    expect(grid[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(grid[1]?.[0]).toBe('2026-11-02');
    expect(grid[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
  });

  test('starts a month that begins on a Wednesday under the third column', () => {
    const [firstRow] = monthGrid(month('2026-04'));

    expect(firstRow).toEqual([
      null,
      null,
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
      '2026-04-04',
      '2026-04-05',
    ]);
  });

  test('puts a month that ends on Sunday in its last cell', () => {
    const grid = monthGrid(month('2026-05'));

    expect(grid.at(-1)?.at(-1)).toBe('2026-05-31');
    expect(grid[0]?.[4]).toBe('2026-05-01');
  });

  test('gives every row seven cells and every day of the month once', () => {
    const grid = monthGrid(month('2024-02'));

    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(grid.flat().filter((day) => day !== null)).toHaveLength(29);
  });

  test('crosses the year without leaking days of the next month', () => {
    const days = monthGrid(month('2026-12')).flat();

    expect(days.filter((day) => day !== null).at(-1)).toBe('2026-12-31');
    expect(days.filter((day) => day !== null).every((day) => day.startsWith('2026-12'))).toBe(true);
  });
});

describe('monthGridRange', () => {
  test('covers February 2027, which starts on a Monday, in exactly four weeks', () => {
    expect(monthGridRange(month('2027-02'))).toEqual({ start: '2027-02-01', end: '2027-02-28' });
  });

  test('covers November 2026, which starts on a Sunday, from the Monday before to the last Sunday', () => {
    expect(monthGridRange(month('2026-11'))).toEqual({ start: '2026-10-26', end: '2026-12-06' });
  });

  test('covers a leap February', () => {
    expect(monthGridRange(month('2028-02'))).toEqual({ start: '2028-01-31', end: '2028-03-05' });
  });

  test('crosses into January from December', () => {
    expect(monthGridRange(month('2026-12'))).toEqual({ start: '2026-11-30', end: '2027-01-03' });
  });
});
