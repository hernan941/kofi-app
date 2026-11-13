import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { Text, View } from 'react-native';

import { addDays, isAfter, type LocalDate } from '@/shared/domain';

import { formatDateLabel } from './date-label';
import { IconButton } from './icon-button';

/** Props of {@link DateField}. */
export interface DateFieldProps {
  readonly label: string;
  readonly value: LocalDate;
  readonly onChange: (date: LocalDate) => void;
  readonly maxDate: LocalDate;
  readonly minDate?: LocalDate;
  readonly today?: LocalDate;
}

/**
 * Date picker for a local day, moved one day at a time with the previous and next
 * buttons, which suits sales that happened today or a few days ago. It never offers a day
 * after `maxDate` (usually today, from `useToday`) or before `minDate`; the limit buttons
 * say so with the disabled state. The date reads as "Hoy, viernes 13 de noviembre" when
 * `today` is given.
 */
export function DateField({ label, value, onChange, maxDate, minDate, today }: DateFieldProps) {
  const next = addDays(value, 1);
  const previous = addDays(value, -1);
  const canGoNext = !isAfter(next, maxDate);
  const canGoPrevious = minDate === undefined || !isAfter(minDate, previous);
  const dateLabel = formatDateLabel(value, today);

  return (
    <View className="gap-2">
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="font-medium text-sm text-foreground"
      >
        {label}
      </Text>
      <View className="bg-field-background flex-row items-center rounded-field border-2 border-field-border">
        <IconButton
          icon={CaretLeftIcon}
          accessibilityLabel="Día anterior"
          isDisabled={!canGoPrevious}
          onPress={() => {
            if (canGoPrevious) onChange(previous);
          }}
        />
        <Text
          accessible
          accessibilityLabel={`${label}: ${dateLabel}`}
          className="flex-1 py-3 text-center font-medium text-base text-foreground"
        >
          {dateLabel}
        </Text>
        <IconButton
          icon={CaretRightIcon}
          accessibilityLabel="Día siguiente"
          isDisabled={!canGoNext}
          onPress={() => {
            if (canGoNext) onChange(next);
          }}
        />
      </View>
    </View>
  );
}
