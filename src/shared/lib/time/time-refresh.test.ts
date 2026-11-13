import {
  TIME_ZONE_FIXTURES,
  type FixtureTimeZone,
} from '@/shared/domain/calendar/__fixtures__/time-zones';
import { deviceLocalCalendar } from '@/shared/domain/calendar/device-local-calendar';
import { epochMsSchema } from '@/shared/domain/epoch-ms';

import { nextTodayRefreshAt } from './time-refresh';

const HOUR_MS = 3_600_000;

const zone = (process.env.TEST_TZ ?? 'America/Santiago') as FixtureTimeZone;
const fixture = TIME_ZONE_FIXTURES[zone];

describe(`nextTodayRefreshAt in ${zone}`, () => {
  test('runs in the expected process time zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
    expect(new Date('2026-07-01T12:00:00Z').getTimezoneOffset()).toBe(fixture.winterOffsetMinutes);
  });

  test.each(fixture.nextMidnight)(
    'wakes at the local midnight half an hour before it: $description',
    ({ expected }) => {
      const midnight = Date.parse(expected);
      const now = epochMsSchema.parse(midnight - HOUR_MS / 2);

      expect(nextTodayRefreshAt(now, deviceLocalCalendar)).toBe(midnight);
    },
  );

  test.each(fixture.nextMidnight)(
    'never waits more than one hour: $description',
    ({ from, expected }) => {
      const now = epochMsSchema.parse(Date.parse(from));

      expect(nextTodayRefreshAt(now, deviceLocalCalendar)).toBe(
        Math.min(Date.parse(expected), now + HOUR_MS),
      );
    },
  );
});
