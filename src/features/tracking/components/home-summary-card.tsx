import { Text, View } from 'react-native';

import {
  AccessibleGroup,
  Amount,
  AmountSentence,
  Card,
  ListRow,
  ListSeparator,
  TextButton,
  sentenceLabel,
  type SentencePart,
} from '@/shared/ui';
import { formatClpAccessible } from '@/shared/domain';

import type { HomeSummary, ProfitSummary } from '../domain';
import { comparisonText } from './comparison-text';
import { ProfitLine } from './profit-line';

/** Props of {@link HomeSummaryCard}. */
export interface HomeSummaryCardProps {
  readonly summary: HomeSummary;
  readonly profit: ProfitSummary | null;
  /** Mes actual en minúscula ("noviembre"). */
  readonly monthName: string;
  /** Mes anterior en minúscula ("octubre"). */
  readonly previousMonthName: string;
  readonly onOpenMonthlySummary: () => void;
}

function blockLabel(
  lead: string,
  total: HomeSummary['week']['total'],
  comparison: readonly SentencePart[],
) {
  return `${lead} vendiste ${formatClpAccessible(total)}. ${sentenceLabel(comparison)}`;
}

/**
 * Tarjeta de Inicio (UX-H1): lo vendido esta semana como monto principal, el mes debajo, sus
 * comparaciones suaves, la ganancia del mes solo con costos y el acceso al resumen mensual.
 * Recibe todo calculado: no suma ni compara.
 */
export function HomeSummaryCard({
  summary,
  profit,
  monthName,
  previousMonthName,
  onOpenMonthlySummary,
}: HomeSummaryCardProps) {
  const weekComparison = comparisonText(summary.week, { kind: 'week' });
  const monthComparison = comparisonText(summary.month, { kind: 'month', previousMonthName });
  return (
    <Card>
      <AccessibleGroup
        label={blockLabel('Esta semana', summary.week.total, weekComparison)}
        contentClassName="gap-1"
      >
        <Text className="font-medium text-sm text-muted">Esta semana</Text>
        <Amount value={summary.week.total} variant="display" />
        <View className="pt-1">
          <AmountSentence parts={weekComparison} size="sm" />
        </View>
      </AccessibleGroup>
      <ListSeparator />
      <View className="gap-1">
        <AccessibleGroup
          label={blockLabel(`En ${monthName}`, summary.month.total, monthComparison)}
        >
          <ListRow title={`En ${monthName}`} amount={summary.month.total} />
          <AmountSentence parts={monthComparison} size="sm" />
        </AccessibleGroup>
        {profit === null ? null : (
          <View className="pt-2">
            <ProfitLine profit={profit} periodLabel="Este mes" />
          </View>
        )}
      </View>
      <View className="items-start pt-1">
        <TextButton label={`Ver resumen de ${monthName}`} onPress={onOpenMonthlySummary} />
      </View>
    </Card>
  );
}
