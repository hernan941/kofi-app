import { clearPerfMarks, perfMark, readPerfMarks } from './perf-marks';

describe('perfMark', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E;
    clearPerfMarks();
  });

  it('records nothing without the E2E flag', () => {
    const mark = jest.spyOn(performance, 'mark');

    perfMark('home:ready');

    expect(readPerfMarks()).toEqual([]);
    expect(mark).not.toHaveBeenCalled();
  });

  it('records the marks in order with the flag, with their detail', () => {
    process.env.EXPO_PUBLIC_E2E = '1';

    perfMark('calendar:month:press', '2026-10');
    perfMark('calendar:month:ready', '2026-10');

    expect(readPerfMarks().map(({ name, detail }) => [name, detail])).toEqual([
      ['calendar:month:press', '2026-10'],
      ['calendar:month:ready', '2026-10'],
    ]);
  });

  it('stamps each mark with a non-decreasing time in milliseconds', () => {
    process.env.EXPO_PUBLIC_E2E = '1';

    perfMark('sale-form:press');
    perfMark('sale-form:ready');

    const [first, second] = readPerfMarks();
    expect(first?.atMs).toBeGreaterThanOrEqual(0);
    expect(second?.atMs).toBeGreaterThanOrEqual(first?.atMs ?? Infinity);
  });

  it('also reports the mark to the platform performance timeline', () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const mark = jest.spyOn(performance, 'mark');

    perfMark('products:ready');

    expect(mark).toHaveBeenCalledWith('products:ready', undefined);
  });

  it('forgets the marks when cleared', () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    perfMark('home:ready');

    clearPerfMarks();

    expect(readPerfMarks()).toEqual([]);
  });
});
