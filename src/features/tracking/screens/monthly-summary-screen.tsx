import { ScrollView } from 'react-native';

import type { SaleRecordId, YearMonth } from '@/shared/domain';
import { yearMonthOf } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';
import { ErrorState, LoadingState, Screen, ScreenHeader } from '@/shared/ui';

import { MonthSwitcher } from '../components/month-switcher';
import { MonthlySummaryView } from '../components/monthly-summary-view';
import { monthNavigation, resolveMonth } from '../domain';
import { useEarliestSaleMonth } from '../hooks/use-earliest-sale-month';
import { useMonthlySummary } from '../hooks/use-monthly-summary';

/** Props of {@link MonthlySummaryScreen}. */
export interface MonthlySummaryScreenProps {
  /** `null` es el mes actual. Un mes futuro se muestra como el actual (`resolveMonth`). */
  readonly requestedMonth: YearMonth | null;
  readonly onChangeMonth: (month: YearMonth) => void;
  readonly onBack: () => void;
  /** Sin uso en la v1: la lista de ventas del mes está en el Calendario. */
  readonly onOpenSale?: (id: SaleRecordId) => void;
}

/**
 * Resumen de un mes con navegación (D-30). El mes visible viene de la URL, no de un estado
 * local. Los botones del selector esperan a conocer el primer mes con ventas.
 */
export function MonthlySummaryScreen({
  requestedMonth,
  onChangeMonth,
  onBack,
}: MonthlySummaryScreenProps) {
  const today = useToday();
  const month = resolveMonth(requestedMonth, today);
  const earliest = useEarliestSaleMonth();
  const state = useMonthlySummary(month);
  const navigation =
    earliest.data === undefined
      ? { canGoBack: false, canGoForward: false }
      : monthNavigation(month, yearMonthOf(today), earliest.data);

  return (
    <Screen>
      <ScreenHeader title="Resumen del mes" onBack={onBack} />
      <MonthSwitcher
        month={month}
        today={today}
        navigation={navigation}
        announcePrefix="Resumen de"
        onChange={onChangeMonth}
      />
      {state.status === 'pending' ? (
        <LoadingState label="Cargando el resumen" shape="cards" count={2} />
      ) : null}
      {state.status === 'error' ? (
        <ErrorState
          message="No se pudo cargar el resumen. Inténtalo de nuevo."
          onRetry={state.refetch}
        />
      ) : null}
      {state.status === 'ready' && state.summary !== null ? (
        <ScrollView contentContainerClassName="pt-4 pb-6">
          <MonthlySummaryView
            summary={state.summary}
            topProducts={state.topProductNames}
            profit={state.profit}
            today={today}
          />
        </ScrollView>
      ) : null}
    </Screen>
  );
}
