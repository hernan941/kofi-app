import { formatClp, formatClpAccessible } from '@/shared/domain';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';
import { sentenceLabel, type SentencePart } from '@/shared/ui';

import { compareTotals, type PeriodSummary } from '../domain';
import { clp } from '../domain/testing/tracking-fixtures';
import { comparisonText, type ComparisonPeriod } from './comparison-text';

const WEEK: ComparisonPeriod = { kind: 'week' };
const MONTH: ComparisonPeriod = { kind: 'month', previousMonthName: 'octubre' };

function summaryOf(total: number, previousTotal: number): PeriodSummary {
  return {
    total: clp(total),
    previousTotal: clp(previousTotal),
    comparison: compareTotals(clp(total), clp(previousTotal)),
  };
}

function plain(parts: readonly SentencePart[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : formatClp(part.amount))).join('');
}

describe('comparisonText', () => {
  it.each([
    [WEEK, summaryOf(25000, 20000), '$5.000 más que a esta altura de la semana pasada.'],
    [MONTH, summaryOf(32000, 20000), '$12.000 más que a esta altura de octubre.'],
    [WEEK, summaryOf(20000, 0), '$20.000 más que a esta altura de la semana pasada.'],
    [MONTH, summaryOf(20000, 0), '$20.000 más que a esta altura de octubre.'],
    [WEEK, summaryOf(20000, 20000), 'Igual que a esta altura de la semana pasada.'],
    [MONTH, summaryOf(20000, 20000), 'Igual que a esta altura de octubre.'],
    [
      WEEK,
      summaryOf(15000, 20000),
      '$5.000 menos que a esta altura de la semana pasada. Cada semana tiene su ritmo.',
    ],
    [
      MONTH,
      summaryOf(8000, 20000),
      '$12.000 menos que a esta altura de octubre. Cada mes tiene su ritmo.',
    ],
    [
      WEEK,
      summaryOf(0, 20000),
      'Semana tranquila por ahora. A esta altura de la semana pasada habías vendido $20.000.',
    ],
    [
      MONTH,
      summaryOf(0, 20000),
      'Mes tranquilo por ahora. A esta altura de octubre habías vendido $20.000.',
    ],
    [WEEK, summaryOf(0, 0), 'Lo que registres esta semana se va sumando aquí.'],
    [MONTH, summaryOf(0, 0), 'Lo que registres este mes se va sumando aquí.'],
  ] as const)('words %j %j as "%s"', (period, summary, expected) => {
    const text = plain(comparisonText(summary, period));

    expect(text).toBe(expected);
    expect(findGuiltPattern(text)).toBeNull();
  });

  it('calls it quiet only when this period is at zero, even if the drop rounds to 100 %', () => {
    const text = plain(comparisonText(summaryOf(1, 1000), WEEK));

    expect(text).toBe(
      `${formatClp(clp(999))} menos que a esta altura de la semana pasada. Cada semana tiene su ritmo.`,
    );
  });

  it('reads the amounts as pesos', () => {
    expect(sentenceLabel(comparisonText(summaryOf(25000, 20000), WEEK))).toBe(
      `${formatClpAccessible(clp(5000))} más que a esta altura de la semana pasada.`,
    );
  });
});
