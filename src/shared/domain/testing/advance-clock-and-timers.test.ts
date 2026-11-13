import { epochMsSchema } from '../epoch-ms';

import { advanceClockAndTimers } from './advance-clock-and-timers';
import { FakeClock } from './fake-clock';

describe('advanceClockAndTimers', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('moves the fake clock and runs the timers that fall in the interval', () => {
    jest.useFakeTimers();
    const clock = new FakeClock(epochMsSchema.parse(1000));
    const callback = jest.fn();
    setTimeout(callback, 500);

    advanceClockAndTimers(clock, 600);

    expect(clock.now()).toBe(1600);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('leaves later timers pending', () => {
    jest.useFakeTimers();
    const clock = new FakeClock(epochMsSchema.parse(0));
    const callback = jest.fn();
    setTimeout(callback, 1000);

    advanceClockAndTimers(clock, 999);

    expect(callback).not.toHaveBeenCalled();
  });
});
