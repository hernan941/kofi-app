import { Text, View } from 'react-native';

import { addMonths, type LocalDate, type YearMonth } from '@/shared/domain';
import { CaretLeftIcon, CaretRightIcon, IconButton, announce } from '@/shared/ui';

import type { MonthNavigation } from '../domain';
import { formatMonthLabel, formatMonthTitle } from './month-label';

/** Props of {@link MonthSwitcher}. */
export interface MonthSwitcherProps {
  readonly month: YearMonth;
  readonly today: LocalDate;
  readonly navigation: MonthNavigation;
  /** "Resumen de" o "Calendario de": se anuncia al cambiar de mes. */
  readonly announcePrefix: string;
  readonly onChange: (month: YearMonth) => void;
}

/**
 * Selector de mes anterior y siguiente (D-30). Los botones fuera de los límites quedan
 * deshabilitados con su estado; el mes es un encabezado con región viva y cada cambio se
 * anuncia.
 */
export function MonthSwitcher({
  month,
  today,
  navigation,
  announcePrefix,
  onChange,
}: MonthSwitcherProps) {
  const previous = addMonths(month, -1);
  const next = addMonths(month, 1);
  const move = (target: YearMonth) => () => {
    announce(`${announcePrefix} ${formatMonthLabel(target, today)}`);
    onChange(target);
  };
  return (
    <View className="min-h-12 flex-row items-center justify-between px-4">
      <IconButton
        icon={CaretLeftIcon}
        accessibilityLabel={
          navigation.canGoBack
            ? `Mes anterior, ${formatMonthLabel(previous, today)}`
            : 'Mes anterior'
        }
        isDisabled={!navigation.canGoBack}
        onPress={move(previous)}
      />
      <Text
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        className="flex-1 text-center font-semibold text-heading text-foreground"
      >
        {formatMonthTitle(month, today)}
      </Text>
      <IconButton
        icon={CaretRightIcon}
        accessibilityLabel={
          navigation.canGoForward
            ? `Mes siguiente, ${formatMonthLabel(next, today)}`
            : 'Mes siguiente'
        }
        isDisabled={!navigation.canGoForward}
        onPress={move(next)}
      />
    </View>
  );
}
