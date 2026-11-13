import { localDateSchema } from '@/shared/domain';

import { formatDateLabel, formatShortDateLabel } from './date-label';

const date = (text: string) => localDateSchema.parse(text);

describe('formatDateLabel', () => {
  it('names today and yesterday', () => {
    const today = date('2026-11-13');

    expect(formatDateLabel(today, today)).toBe('Hoy, viernes 13 de noviembre');
    expect(formatDateLabel(date('2026-11-12'), today)).toBe('Ayer, jueves 12 de noviembre');
  });

  it('omits the year inside the current year and adds it otherwise', () => {
    const today = date('2026-11-13');

    expect(formatDateLabel(date('2026-03-02'), today)).toBe('Lunes 2 de marzo');
    expect(formatDateLabel(date('2025-12-31'), today)).toBe('Miércoles 31 de diciembre de 2025');
  });

  it('always adds the year without a reference day', () => {
    expect(formatDateLabel(date('2026-11-13'))).toBe('Viernes 13 de noviembre de 2026');
  });
});

describe('formatShortDateLabel', () => {
  const today = date('2026-11-13');

  it('names today and yesterday', () => {
    expect(formatShortDateLabel(today, today)).toBe('Hoy');
    expect(formatShortDateLabel(date('2026-11-12'), today)).toBe('Ayer');
  });

  it('writes day and month inside the current year', () => {
    expect(formatShortDateLabel(date('2026-11-09'), today)).toBe('9 de noviembre');
  });

  it('adds the year when it is not the current one', () => {
    expect(formatShortDateLabel(date('2025-12-28'), today)).toBe('28 de diciembre de 2025');
  });

  it('calls the 31st of December yesterday on January 1st', () => {
    expect(formatShortDateLabel(date('2025-12-31'), date('2026-01-01'))).toBe('Ayer');
  });
});
