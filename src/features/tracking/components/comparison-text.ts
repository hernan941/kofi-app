import type { SentencePart } from '@/shared/ui';

import type { PeriodSummary } from '../domain';

/** Período que se compara: la semana o el mes (con el nombre del mes anterior). */
export type ComparisonPeriod =
  { readonly kind: 'week' } | { readonly kind: 'month'; readonly previousMonthName: string };

interface PeriodWords {
  readonly reference: string;
  readonly capitalizedReference: string;
  readonly rhythm: string;
  readonly quiet: string;
  readonly empty: string;
}

function wordsOf(period: ComparisonPeriod): PeriodWords {
  if (period.kind === 'week') {
    return {
      reference: 'a esta altura de la semana pasada',
      capitalizedReference: 'A esta altura de la semana pasada',
      rhythm: 'Cada semana tiene su ritmo.',
      quiet: 'Semana tranquila por ahora.',
      empty: 'Lo que registres esta semana se va sumando aquí.',
    };
  }
  return {
    reference: `a esta altura de ${period.previousMonthName}`,
    capitalizedReference: `A esta altura de ${period.previousMonthName}`,
    rhythm: 'Cada mes tiene su ritmo.',
    quiet: 'Mes tranquilo por ahora.',
    empty: 'Lo que registres este mes se va sumando aquí.',
  };
}

/**
 * Frase de comparación suave (D-19, D-39) del total contra el tramo equivalente anterior:
 * siempre positiva, también cuando baja. Devuelve partes para `AmountSentence`, que lee los
 * montos como pesos.
 */
export function comparisonText(
  summary: PeriodSummary,
  period: ComparisonPeriod,
): readonly SentencePart[] {
  const words = wordsOf(period);
  const { comparison } = summary;
  switch (comparison.kind) {
    case 'no_data':
      return [words.empty];
    case 'first':
      return [{ amount: summary.total }, ` más que ${words.reference}.`];
    case 'same':
      return [`Igual que ${words.reference}.`];
    case 'up':
      return [{ amount: comparison.difference }, ` más que ${words.reference}.`];
    case 'down':
      return summary.total === 0
        ? [
            `${words.quiet} ${words.capitalizedReference} habías vendido `,
            { amount: summary.previousTotal },
            '.',
          ]
        : [{ amount: comparison.difference }, ` menos que ${words.reference}. ${words.rhythm}`];
  }
}
