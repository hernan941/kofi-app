import { Text, View } from 'react-native';

import { SALE_CHANNEL_LABELS } from '@/features/sales';
import { yearMonthOf, type LocalDate } from '@/shared/domain';
import {
  Amount,
  CalendarBlankIcon,
  Card,
  EmptyState,
  Icon,
  ListRow,
  ListSeparator,
  StorefrontIcon,
} from '@/shared/ui';

import type { MonthlySummary, ProfitSummary } from '../domain';
import type { ProductNameView } from '../hooks/use-monthly-summary';
import { formatMonthLabel, formatMonthTitle } from './month-label';
import { ProfitLine } from './profit-line';

/** Props of {@link MonthlySummaryView}. */
export interface MonthlySummaryViewProps {
  readonly summary: MonthlySummary;
  readonly topProducts: readonly ProductNameView[];
  readonly profit: ProfitSummary | null;
  readonly today: LocalDate;
}

function recordsText(count: number): string {
  return count === 1 ? '1 venta registrada' : `${String(count)} ventas registradas`;
}

function RankingCard({
  title,
  isTie,
  children,
}: {
  readonly title: string;
  readonly isTie: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <Card title={title}>
      <View className="gap-1">
        <Text className="text-sm text-muted">Según el monto vendido.</Text>
        {isTie ? <Text className="text-sm text-muted">Empataron con el mismo monto.</Text> : null}
      </View>
      {children}
    </Card>
  );
}

function separated(rows: readonly React.ReactNode[]) {
  return rows.map((row, index) => (
    <View key={index}>
      {index > 0 ? <ListSeparator /> : null}
      {row}
    </View>
  ));
}

/**
 * Contenido del resumen de un mes (D-20, D-40): total, ventas registradas, ganancia con
 * costos, lo que más vendiste y dónde vendiste más. Un mes sin ventas muestra un estado
 * amable. Recibe todo calculado.
 */
export function MonthlySummaryView({
  summary,
  topProducts,
  profit,
  today,
}: MonthlySummaryViewProps) {
  const isCurrentMonth = summary.month === yearMonthOf(today);
  const monthLabel = formatMonthLabel(summary.month, today);
  if (summary.recordCount === 0) {
    return (
      <EmptyState
        icon={CalendarBlankIcon}
        title={`${formatMonthTitle(summary.month, today)} no tiene ventas anotadas`}
        description={
          isCurrentMonth
            ? 'Las ventas que registres este mes van a aparecer aquí.'
            : `Si vendiste algo en ${monthLabel}, puedes registrarlo eligiendo esa fecha.`
        }
      />
    );
  }
  return (
    <View className="gap-4">
      <View className="gap-1 px-4">
        <Text className="font-medium text-sm text-muted">Vendiste</Text>
        <Amount value={summary.total} variant="display" />
        <Text className="text-sm text-muted">{recordsText(summary.recordCount)}</Text>
      </View>
      <View className="px-4">
        <ProfitLine
          profit={profit}
          periodLabel={isCurrentMonth ? 'Este mes' : `En ${monthLabel}`}
        />
      </View>
      {topProducts.length === 0 ? null : (
        <View className="px-4">
          <RankingCard title="Lo que más vendiste" isTie={topProducts.length > 1}>
            {separated(
              topProducts.map((top) => (
                <ListRow
                  key={top.productId}
                  title={top.name ?? 'Producto sin nombre'}
                  subtitle={top.isArchived ? 'Archivado' : undefined}
                  amount={top.revenue}
                />
              )),
            )}
          </RankingCard>
        </View>
      )}
      {summary.topChannels.length === 0 ? null : (
        <View className="px-4">
          <RankingCard title="Dónde vendiste más" isTie={summary.topChannels.length > 1}>
            {separated(
              summary.topChannels.map((top) => (
                <ListRow
                  key={top.channel}
                  leading={<Icon icon={StorefrontIcon} size="md" color="muted" />}
                  title={SALE_CHANNEL_LABELS[top.channel]}
                  amount={top.revenue}
                />
              )),
            )}
          </RankingCard>
        </View>
      )}
    </View>
  );
}
