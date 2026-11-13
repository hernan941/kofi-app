import { systemClock } from './clock';

describe('systemClock', () => {
  test('returns the current instant as epoch milliseconds', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-13T12:00:00Z'));

    expect(systemClock.now()).toBe(Date.parse('2026-11-13T12:00:00Z'));

    jest.useRealTimers();
  });
});
