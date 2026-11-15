import { Text, View } from 'react-native';

import { CheckIcon, Icon } from '@/shared/ui';
import type { LocalDate } from '@/shared/domain';

import type { CalendarMonth } from '../domain';
import { CalendarDayCell } from './calendar-day-cell';

/** Props of {@link MonthCalendar}. */
export interface MonthCalendarProps {
  readonly calendar: CalendarMonth;
  readonly onOpenDay: (date: LocalDate) => void;
}

const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

function WeekdayHeader() {
  return (
    <View
      className="flex-row"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {WEEKDAY_INITIALS.map((initial, index) => (
        <Text key={index} className="flex-1 text-center font-medium text-xs text-muted">
          {initial}
        </Text>
      ))}
    </View>
  );
}

/**
 * Cuadrícula del mes (3.1 del diseño de F5): encabezado de L a D y de 4 a 6 filas de 7 celdas,
 * con margen `px-3`. Las semanas marcadas como "no vendí" llevan fondo y una línea de texto
 * (el estado no depende del color). Son como mucho 42 celdas memoizadas: sin listas virtualizadas.
 */
export function MonthCalendar({ calendar, onOpenDay }: MonthCalendarProps) {
  return (
    <View className="gap-y-1 px-3">
      <WeekdayHeader />
      {calendar.weeks.map((week) => (
        <View key={week.week.start} className="gap-1">
          <View className={`flex-row ${week.noSalesMarked ? 'rounded-2xl bg-surface' : ''}`}>
            {week.days.map((day) => (
              <CalendarDayCell
                key={day.date}
                day={day}
                weekMarked={week.noSalesMarked}
                onOpenDay={onOpenDay}
              />
            ))}
          </View>
          {week.noSalesMarked ? (
            <View className="flex-row items-center justify-center gap-1">
              <Icon icon={CheckIcon} size="sm" color="muted" />
              <Text className="font-medium text-xs text-muted">
                Semana marcada como &quot;no vendí&quot;
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
