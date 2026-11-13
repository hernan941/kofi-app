import { Text, View } from 'react-native';

import { AmountSentence } from '@/shared/ui';

import { profitCoverage, type ProfitSummary } from '../domain';

/** Props of {@link ProfitLine}. */
export interface ProfitLineProps {
  readonly profit: ProfitSummary | null;
  /** "Este mes" o "En octubre". */
  readonly periodLabel: string;
}

/**
 * Frase de la ganancia aproximada (D-15, D-39): sin costos no dibuja nada; con cobertura
 * parcial aclara que solo cuenta lo que tiene costo cargado; si es negativa agrega una
 * explicación tranquila, sin `danger`.
 */
export function ProfitLine({ profit, periodLabel }: ProfitLineProps) {
  if (profit === null) {
    return null;
  }
  const lead =
    profitCoverage(profit) === 'full'
      ? `${periodLabel} te quedaron aprox. `
      : `${periodLabel}, de lo que tiene costo cargado, te quedaron aprox. `;
  return (
    <View className="gap-1">
      <AmountSentence parts={[lead, { amount: profit.profit }, '.']} />
      {profit.profit < 0 ? (
        <Text className="text-sm text-muted">
          A veces pasa, por ejemplo con descuentos o precios especiales.
        </Text>
      ) : null}
    </View>
  );
}
