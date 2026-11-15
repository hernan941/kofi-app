import { deviceLocalCalendar as calendar, localDateSchema, type EpochMs } from '@/shared/domain';

import { backupDateOf, formatBackupDate } from './backup-date';

const at = (date: string, hour: number, minute: number): EpochMs =>
  calendar.instantAt(localDateSchema.parse(date), hour * 60 + minute);

const NOW = at('2026-11-13', 18, 0);

describe('formatBackupDate', () => {
  it('says "hoy" with the 24 hour time of the same local day', () => {
    expect(formatBackupDate(at('2026-11-13', 15, 42), NOW, calendar)).toEqual({
      text: 'hoy, 15:42',
      isRelative: true,
    });
  });

  it('says "ayer" without a leading zero in the hour', () => {
    expect(formatBackupDate(at('2026-11-12', 9, 5), NOW, calendar)).toEqual({
      text: 'ayer, 9:05',
      isRelative: true,
    });
  });

  it('writes the full date for any other day', () => {
    expect(formatBackupDate(at('2026-11-10', 15, 42), NOW, calendar)).toEqual({
      text: '10 de noviembre de 2026, 15:42',
      isRelative: false,
    });
  });

  it('keeps a backup made at 23:59 on its local day', () => {
    expect(formatBackupDate(at('2026-11-12', 23, 59), NOW, calendar).text).toBe('ayer, 23:59');
    expect(formatBackupDate(at('2026-11-13', 23, 59), at('2026-11-14', 8, 0), calendar).text).toBe(
      'ayer, 23:59',
    );
  });

  it('shows midnight as 0:00', () => {
    expect(formatBackupDate(at('2026-11-10', 0, 0), NOW, calendar).text).toBe(
      '10 de noviembre de 2026, 0:00',
    );
  });
});

describe('backupDateOf', () => {
  it('joins the article to the date: "de hoy" and "del 10 de noviembre"', () => {
    expect(backupDateOf({ text: 'hoy, 15:42', isRelative: true })).toBe('de hoy, 15:42');
    expect(backupDateOf({ text: '10 de noviembre de 2026, 15:42', isRelative: false })).toBe(
      'del 10 de noviembre de 2026, 15:42',
    );
  });
});
