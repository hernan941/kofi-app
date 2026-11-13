import { epochMsSchema } from '../epoch-ms';

import { FakeClock } from './fake-clock';

const at = (value: number) => epochMsSchema.parse(value);

describe('FakeClock', () => {
  test('starts at the given instant and does not move by itself', () => {
    const clock = new FakeClock(at(1000));

    expect(clock.now()).toBe(1000);
    expect(clock.now()).toBe(1000);
  });

  test('set replaces the instant', () => {
    const clock = new FakeClock(at(1000));

    clock.set(at(5000));

    expect(clock.now()).toBe(5000);
  });

  test('advance moves the instant forward', () => {
    const clock = new FakeClock(at(1000));

    clock.advance(250);
    clock.advance(250);

    expect(clock.now()).toBe(1500);
  });
});
