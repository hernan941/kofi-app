import { localDateSchema, yearMonthSchema } from '@/shared/domain';

import { formatMonthLabel, formatMonthTitle } from './month-label';

const today = localDateSchema.parse('2026-11-13');

describe('formatMonthLabel', () => {
  it('writes only the month inside the current year', () => {
    expect(formatMonthLabel(yearMonthSchema.parse('2026-11'), today)).toBe('noviembre');
  });

  it('adds the year when it is not the current one', () => {
    expect(formatMonthLabel(yearMonthSchema.parse('2025-12'), today)).toBe('diciembre de 2025');
  });
});

describe('formatMonthTitle', () => {
  it('capitalizes the label to start a sentence', () => {
    expect(formatMonthTitle(yearMonthSchema.parse('2026-11'), today)).toBe('Noviembre');
    expect(formatMonthTitle(yearMonthSchema.parse('2025-12'), today)).toBe('Diciembre de 2025');
  });
});
