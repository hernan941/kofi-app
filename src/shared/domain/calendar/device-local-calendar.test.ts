import { TIME_ZONE_FIXTURES, type FixtureTimeZone } from './__fixtures__/time-zones';
import { addDays, localDateParts } from './arithmetic';
import { deviceLocalCalendar } from './device-local-calendar';
import { localDateSchema } from './local-date';
import { epochMsSchema } from '../epoch-ms';

const zone = (process.env.TEST_TZ ?? 'America/Santiago') as FixtureTimeZone;
const fixture = TIME_ZONE_FIXTURES[zone];
const instant = (iso: string) => epochMsSchema.parse(Date.parse(iso));
const isoOf = (value: number) => new Date(value).toISOString().replace('.000Z', 'Z');

describe(`deviceLocalCalendar in ${zone}`, () => {
  test('runs in the expected process time zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
    expect(new Date('2026-07-01T12:00:00Z').getTimezoneOffset()).toBe(fixture.winterOffsetMinutes);
  });

  describe('localDateOf', () => {
    test.each(fixture.localDates)('$instant is $date', ({ instant: iso, date }) => {
      expect(deviceLocalCalendar.localDateOf(instant(iso))).toBe(date);
    });
  });

  describe('instantAt', () => {
    test.each(fixture.instantAt)(
      '$description ($date, minute $minuteOfDay)',
      ({ date, minuteOfDay, expected }) => {
        const result = deviceLocalCalendar.instantAt(localDateSchema.parse(date), minuteOfDay);

        expect(isoOf(result)).toBe(expected);
      },
    );

    test.each([-1, 1440, 1.5, Number.NaN])('rejects minute %p', (minute) => {
      expect(() =>
        deviceLocalCalendar.instantAt(localDateSchema.parse('2026-07-01'), minute),
      ).toThrow(RangeError);
    });

    test('always lands on the requested date and never goes backwards within a day', () => {
      let current = localDateSchema.parse('2026-03-25');
      const minutes = [0, 30, 59, 60, 61, 720, 1260, 1290, 1320, 1350, 1380, 1410, 1439];

      for (let index = 0; index < 190; index += 1) {
        const instants = minutes.map((minute) => deviceLocalCalendar.instantAt(current, minute));

        instants.forEach((value) => {
          expect(deviceLocalCalendar.localDateOf(value)).toBe(current);
        });
        expect([...instants].sort((a, b) => a - b)).toEqual(instants);
        current = addDays(current, 1);
      }
    });

    test('a Sunday 20:00 reminder keeps its wall time in every week around the changes', () => {
      const sundays = [
        '2026-03-29',
        '2026-04-05',
        '2026-04-12',
        '2026-08-30',
        '2026-09-06',
        '2026-09-13',
      ];

      sundays.forEach((sunday) => {
        const result = deviceLocalCalendar.instantAt(localDateSchema.parse(sunday), 1200);
        const local = new Date(result);

        expect(localDateParts(deviceLocalCalendar.localDateOf(result))).toEqual({
          year: local.getFullYear(),
          month: local.getMonth() + 1,
          day: local.getDate(),
        });
        expect(local.getHours() * 60 + local.getMinutes()).toBe(1200);
      });
    });
  });

  describe('nextLocalMidnight', () => {
    test.each(fixture.nextMidnight)('$description', ({ from, expected }) => {
      expect(isoOf(deviceLocalCalendar.nextLocalMidnight(instant(from)))).toBe(expected);
    });

    test('is always strictly after the instant and on the following date', () => {
      const start = Date.parse('2026-03-30T00:00:00Z');

      for (let offset = 0; offset < 200 * 24 * 60; offset += 97) {
        const from = epochMsSchema.parse(start + offset * 60_000);
        const next = deviceLocalCalendar.nextLocalMidnight(from);

        expect(next).toBeGreaterThan(from);
        expect(deviceLocalCalendar.localDateOf(next)).toBe(
          addDays(deviceLocalCalendar.localDateOf(from), 1),
        );
      }
    });
  });
});
