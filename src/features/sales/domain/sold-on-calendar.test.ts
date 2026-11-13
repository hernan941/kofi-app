import {
  addDays,
  deviceLocalCalendar,
  epochMsSchema,
  localDateSchema,
  type LocalDate,
} from '@/shared/domain';
import {
  TIME_ZONE_FIXTURES,
  type FixtureTimeZone,
} from '@/shared/domain/calendar/__fixtures__/time-zones';
import { FakeClock } from '@/shared/domain/testing/fake-clock';

import { validateSoldOn } from './rules';

const zone = (process.env.TEST_TZ ?? 'America/Santiago') as FixtureTimeZone;
const fixture = TIME_ZONE_FIXTURES[zone];
const day = (value: string) => localDateSchema.parse(value);
const DAYS = ['2026-01-14', '2026-07-01', ...fixture.dstDays];

function codesAt(instantMs: number, soldOn: LocalDate): readonly string[] {
  const clock = new FakeClock(epochMsSchema.parse(instantMs));
  const today = deviceLocalCalendar.localDateOf(clock.now());
  return validateSoldOn(soldOn, today, null).map((e) => e.code);
}

describe(`validateSoldOn with the device calendar in ${zone}`, () => {
  test('runs in the expected process time zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
  });

  test.each(DAYS)(
    'at 23:59 local on %s, that day and the past pass and the next is future',
    (value) => {
      const instant = deviceLocalCalendar.instantAt(day(value), 1439);

      expect(codesAt(instant, day(value))).toEqual([]);
      expect(codesAt(instant, addDays(day(value), -1))).toEqual([]);
      expect(codesAt(instant, addDays(day(value), 1))).toEqual(['future_date']);
    },
  );

  test.each(DAYS)('at 00:00 local on %s, that day passes and the next is future', (value) => {
    const instant = deviceLocalCalendar.instantAt(day(value), 0);

    expect(codesAt(instant, day(value))).toEqual([]);
    expect(codesAt(instant, addDays(day(value), 1))).toEqual(['future_date']);
  });

  test.each(DAYS)('crossing the local midnight after %s moves "today" by one day', (value) => {
    const last = deviceLocalCalendar.instantAt(day(value), 1439);
    const midnight = deviceLocalCalendar.nextLocalMidnight(epochMsSchema.parse(last));
    const next = addDays(day(value), 1);

    expect(codesAt(last, next)).toEqual(['future_date']);
    expect(codesAt(midnight, next)).toEqual([]);
    expect(codesAt(midnight, addDays(next, 1))).toEqual(['future_date']);
  });
});
