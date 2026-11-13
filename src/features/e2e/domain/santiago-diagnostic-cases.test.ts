import { TIME_ZONE_FIXTURES } from '@/shared/domain/calendar/__fixtures__/time-zones';

import { SANTIAGO_DIAGNOSTIC_CASES } from './santiago-diagnostic-cases';

const fixture = TIME_ZONE_FIXTURES['America/Santiago'];

describe('SANTIAGO_DIAGNOSTIC_CASES', () => {
  test('mirrors the Santiago fixture used by the calendar tests', () => {
    expect(SANTIAGO_DIAGNOSTIC_CASES.zone).toBe(fixture.zone);
    expect(
      SANTIAGO_DIAGNOSTIC_CASES.localDates.map(({ instant, date }) => [instant, date]),
    ).toEqual(fixture.localDates.map(({ instant, date }) => [Date.parse(instant), date]));
    expect(
      SANTIAGO_DIAGNOSTIC_CASES.instantAt.map(({ date, minuteOfDay, expected }) => [
        date,
        minuteOfDay,
        expected,
      ]),
    ).toEqual(
      fixture.instantAt.map(({ date, minuteOfDay, expected }) => [
        date,
        minuteOfDay,
        Date.parse(expected),
      ]),
    );
    expect(
      SANTIAGO_DIAGNOSTIC_CASES.nextMidnight.map(({ from, expected }) => [from, expected]),
    ).toEqual(
      fixture.nextMidnight.map(({ from, expected }) => [Date.parse(from), Date.parse(expected)]),
    );
  });
});
