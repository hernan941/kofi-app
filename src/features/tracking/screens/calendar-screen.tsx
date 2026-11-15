import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { formatClpAccessible, yearMonthOf, type LocalDate, type YearMonth } from '@/shared/domain';
import { perfMark } from '@/shared/lib/perf-marks';
import { useToday } from '@/shared/lib/time/use-today';
import {
  Amount,
  ErrorState,
  InfoIcon,
  InlineNotice,
  LoadingState,
  Screen,
  ScreenHeader,
  AccessibleGroup,
} from '@/shared/ui';

import { CalendarLegend } from '../components/calendar-legend';
import { formatMonthLabel } from '../components/month-label';
import { MonthCalendar } from '../components/month-calendar';
import { MonthSwitcher } from '../components/month-switcher';
import { StreakBadge } from '../components/streak-badge';
import { WeekNoSalesAction } from '../components/week-no-sales-action';
import { calendarNavigationLimit, monthNavigation } from '../domain';
import { useCalendarMonth } from '../hooks/use-calendar-month';
import { useEarliestSaleMonth } from '../hooks/use-earliest-sale-month';
import { useStreak } from '../hooks/use-streak';

/** Props of {@link CalendarScreen}. */
export interface CalendarScreenProps {
  readonly onOpenDay: (date: LocalDate) => void;
}

/**
 * Calendario (UX-C1 a UX-C10): racha, selector de mes, total, cuadrícula con intensidad,
 * leyenda y, solo en el mes actual, el bloque "no vendí". El mes visible es estado de la
 * pantalla: empieza en el actual y se queda donde está al cambiar el día o la semana.
 */
export function CalendarScreen({ onOpenDay }: CalendarScreenProps) {
  const today = useToday();
  const currentMonth = yearMonthOf(today);
  const [month, setMonth] = useState<YearMonth>(currentMonth);
  const { status, calendar, refetch } = useCalendarMonth(month);
  const streak = useStreak().data;
  const earliestSale = useEarliestSaleMonth().data;
  const isMonthPainted = status === 'ready' && calendar !== null;
  const hasMarkedReady = useRef(false);
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_E2E === '1' && isMonthPainted) {
      if (!hasMarkedReady.current) {
        hasMarkedReady.current = true;
        perfMark('calendar:ready', month);
      }
      perfMark('calendar:month:ready', month);
    }
  }, [isMonthPainted, month]);
  const navigation = monthNavigation(
    month,
    currentMonth,
    calendarNavigationLimit(today, earliestSale ?? null),
  );
  const monthLabel = formatMonthLabel(month, today);
  const isCurrentMonth = month === currentMonth;
  return (
    <Screen>
      <ScreenHeader title="Calendario" />
      <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-6">
        {streak === undefined ? null : (
          <View className="px-4">
            <StreakBadge streak={streak} variant="full" />
          </View>
        )}
        <MonthSwitcher
          month={month}
          today={today}
          navigation={navigation}
          announcePrefix="Calendario de"
          onChange={(target) => {
            if (process.env.EXPO_PUBLIC_E2E === '1') {
              perfMark('calendar:month:press', target);
            }
            setMonth(target);
          }}
        />
        {status === 'error' ? (
          <ErrorState
            message="No se pudo cargar el calendario. Inténtalo de nuevo."
            onRetry={refetch}
          />
        ) : null}
        {status === 'pending' || (status === 'ready' && calendar === null) ? (
          <LoadingState label="Cargando el calendario" shape="cards" count={1} />
        ) : null}
        {calendar === null ? null : (
          <>
            <AccessibleGroup
              label={`Vendiste en ${monthLabel}: ${formatClpAccessible(calendar.monthTotal)}`}
              className="px-4"
              contentClassName="flex-row items-center justify-between gap-4"
            >
              <Text className="font-medium text-base text-foreground">
                Vendiste en {monthLabel}
              </Text>
              <Amount value={calendar.monthTotal} variant="total" />
            </AccessibleGroup>
            <MonthCalendar calendar={calendar} onOpenDay={onOpenDay} />
            <View className="px-4">
              {calendar.hasSales ? (
                <CalendarLegend />
              ) : (
                <InlineNotice
                  icon={InfoIcon}
                  message="Los días en que registres ventas se marcan aquí con puntos."
                />
              )}
            </View>
            {isCurrentMonth ? (
              <View className="px-4 pt-2">
                <WeekNoSalesAction />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
