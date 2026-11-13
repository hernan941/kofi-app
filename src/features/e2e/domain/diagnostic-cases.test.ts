import { deviceLocalCalendar } from '@/shared/domain/calendar/device-local-calendar';
import type { LocalCalendar } from '@/shared/domain/calendar/local-calendar';
import { localDateSchema } from '@/shared/domain/calendar/local-date';

import { runDateDiagnostics } from './diagnostic-cases';

const activeZone = process.env.TEST_TZ ?? 'America/Santiago';

describe(`runDateDiagnostics in ${activeZone}`, () => {
  test('runs in the expected process time zone', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(activeZone);
  });

  test('flags the cases of the diagnostic zone when the device is in another Chilean zone', () => {
    if (activeZone === 'America/Santiago') {
      expect(runDateDiagnostics(deviceLocalCalendar).failures).toBe(0);
    } else {
      expect(runDateDiagnostics(deviceLocalCalendar).failures).toBeGreaterThan(0);
    }
  });

  test('the device calendar passes every case of the fixture zone', () => {
    if (activeZone !== 'America/Santiago') {
      return;
    }
    const report = runDateDiagnostics(deviceLocalCalendar);

    expect(report.zone).toBe('America/Santiago');
    expect(report.rows.length).toBeGreaterThan(10);
    expect(report.failures).toBe(0);
    expect(report.rows.every((row) => row.passed)).toBe(true);
  });

  test('covers localDateOf, instantAt and nextLocalMidnight', () => {
    const kinds = new Set(runDateDiagnostics(deviceLocalCalendar).rows.map((row) => row.kind));

    expect(kinds).toEqual(new Set(['localDateOf', 'instantAt', 'nextLocalMidnight']));
  });

  test('reports the cases where the calendar disagrees with the fixture', () => {
    const broken: LocalCalendar = {
      ...deviceLocalCalendar,
      localDateOf: () => localDateSchema.parse('1999-01-01'),
    };

    const report = runDateDiagnostics(broken);

    const localDateRows = report.rows.filter((row) => row.kind === 'localDateOf');
    expect(localDateRows.every((row) => !row.passed && row.actual === '1999-01-01')).toBe(true);
    expect(report.failures).toBeGreaterThanOrEqual(localDateRows.length);
  });

  test('is deterministic', () => {
    expect(runDateDiagnostics(deviceLocalCalendar)).toEqual(
      runDateDiagnostics(deviceLocalCalendar),
    );
  });
});
