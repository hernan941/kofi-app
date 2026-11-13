import { ScrollView, View } from 'react-native';

import { useStreak } from '../hooks/use-streak';
import { addMonths, monthName, yearMonthOf, type SaleRecordId } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PlusIcon,
  PrimaryButton,
  ReceiptIcon,
  Screen,
  ScreenHeader,
} from '@/shared/ui';

import { HomeSummaryCard } from '../components/home-summary-card';
import { LatestSalesList } from '../components/latest-sales-list';
import { StreakBadge } from '../components/streak-badge';
import { useHomeSummary } from '../hooks/use-home-summary';
import { useLatestSales } from '../hooks/use-latest-sales';

/** Props of {@link HomeScreen}. */
export interface HomeScreenProps {
  readonly onRegisterSale: () => void;
  readonly onOpenSale: (id: SaleRecordId) => void;
  readonly onOpenMonthlySummary: () => void;
}

function monthNameOf(month: ReturnType<typeof yearMonthOf>): string {
  return monthName(Number(month.slice(5, 7)));
}

/**
 * Inicio (UX-H1 a UX-H9): resumen de la semana y del mes con comparación suave, ganancia solo
 * con costos, racha desde una semana, últimas ventas y "Registrar venta" fijo abajo. Sin
 * consejos (D-11). El primer uso reemplaza todo por el estado vacío con un único botón.
 */
export function HomeScreen({ onRegisterSale, onOpenSale, onOpenMonthlySummary }: HomeScreenProps) {
  const today = useToday();
  const home = useHomeSummary();
  const latest = useLatestSales();
  const streak = useStreak().data;
  const compactStreak =
    streak === undefined ? null : <StreakBadge streak={streak} variant="compact" />;

  const retry = () => {
    home.refetch();
    latest.refetch();
  };
  const footer = (
    <View className="px-4 pt-2 pb-4">
      <PrimaryButton label="Registrar venta" icon={PlusIcon} onPress={onRegisterSale} />
    </View>
  );

  if (home.status === 'error') {
    return (
      <Screen>
        <ScreenHeader title="Inicio" />
        <View className="flex-1">
          <ErrorState
            message="No se pudieron cargar tus ventas. Inténtalo de nuevo."
            onRetry={retry}
          />
        </View>
        {footer}
      </Screen>
    );
  }
  if (home.status === 'pending' || latest.status === 'pending' || home.summary === null) {
    return (
      <Screen>
        <ScreenHeader title="Inicio" />
        <LoadingState label="Cargando tus ventas" shape="cards" count={2} />
      </Screen>
    );
  }
  if (latest.status === 'ready' && latest.sales.length === 0) {
    return (
      <Screen>
        <ScreenHeader title="Inicio" />
        <EmptyState
          icon={ReceiptIcon}
          title="Aquí vas a ver cuánto vendes"
          description="Registra tu primera venta y verás el total de la semana y del mes. Toma unos segundos."
          primaryAction={{ label: 'Registrar venta', onPress: onRegisterSale }}
        />
        <View className="px-4">{compactStreak}</View>
      </Screen>
    );
  }
  const currentMonth = yearMonthOf(today);
  return (
    <Screen>
      <ScreenHeader title="Inicio" />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-6">
        <HomeSummaryCard
          summary={home.summary}
          profit={home.profit}
          monthName={monthNameOf(currentMonth)}
          previousMonthName={monthNameOf(addMonths(currentMonth, -1))}
          onOpenMonthlySummary={onOpenMonthlySummary}
        />
        {compactStreak}
        <LatestSalesList
          status={latest.status}
          sales={latest.sales}
          today={today}
          onOpenSale={onOpenSale}
          onRetry={latest.refetch}
        />
      </ScrollView>
      {footer}
    </Screen>
  );
}
