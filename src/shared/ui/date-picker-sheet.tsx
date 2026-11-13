import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  addMonths,
  compareYearMonth,
  isAfter,
  localDateParts,
  monthGrid,
  monthName,
  monthRangeOf,
  yearMonthOf,
  type LocalDate,
  type YearMonth,
} from '@/shared/domain';

import { announce } from './announce';
import { formatDateLabel } from './date-label';
import { IconButton } from './icon-button';
import { CaretLeftIcon, CaretRightIcon } from './icons';
import { Sheet } from './sheet';

/** Props of {@link DatePickerSheet}. */
export interface DatePickerSheetProps {
  readonly isOpen: boolean;
  readonly title: string;
  /** Day shown as chosen; its month is the one the calendar opens on. */
  readonly value: LocalDate;
  /** Last day that can be chosen (usually today, from `useToday`); later days are disabled. */
  readonly maxDate: LocalDate;
  /** Today, to mark it and to read the days as "Hoy, …" and "Ayer, …". */
  readonly today: LocalDate;
  readonly onSelect: (date: LocalDate) => void;
  readonly onClose: () => void;
}

const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

/** Header text of a month: "Noviembre de 2026". */
function monthTitle(month: YearMonth): string {
  const { year, month: monthNumber } = localDateParts(monthRangeOf(month).start);
  const name = monthName(monthNumber);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${String(year)}`;
}

/** Props of {@link DayCell}. */
interface DayCellProps {
  readonly day: LocalDate | null;
  readonly value: LocalDate;
  readonly maxDate: LocalDate;
  readonly today: LocalDate;
  readonly onPick: (day: LocalDate) => void;
}

/** One cell of the grid: a day button of at least 48 × 48, or an empty space of the same size. */
function DayCell({ day, value, maxDate, today, onPick }: DayCellProps) {
  if (day === null) {
    return <View className="size-12" />;
  }
  const isSelected = day === value;
  const isToday = day === today;
  const isDisabled = isAfter(day, maxDate);
  const border =
    isToday && !isSelected ? 'border-2 border-foreground' : 'border-2 border-transparent';
  const fill = isSelected ? 'bg-accent' : 'bg-transparent';
  const textColor = isSelected ? 'text-accent-foreground' : 'text-foreground';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={formatDateLabel(day, today)}
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => {
        onPick(day);
      }}
      className={`size-12 items-center justify-center rounded-full ${fill} ${border} ${isDisabled ? 'opacity-disabled' : ''}`}
    >
      <Text className={`font-medium text-base ${textColor}`}>
        {String(localDateParts(day).day)}
      </Text>
    </Pressable>
  );
}

/** Month calendar inside the sheet; remounted on every opening so it starts on the chosen month. */
function MonthCalendar({
  value,
  maxDate,
  today,
  onSelect,
  onClose,
}: Omit<DatePickerSheetProps, 'isOpen' | 'title'>) {
  const [month, setMonth] = useState<YearMonth>(() => yearMonthOf(value));
  const nextMonth = addMonths(month, 1);
  const canGoNext = compareYearMonth(nextMonth, yearMonthOf(maxDate)) <= 0;

  const pick = (day: LocalDate) => {
    onSelect(day);
    announce(formatDateLabel(day, today));
    onClose();
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-center">
        <IconButton
          icon={CaretLeftIcon}
          accessibilityLabel="Mes anterior"
          onPress={() => {
            setMonth(addMonths(month, -1));
          }}
        />
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-semibold text-base text-foreground"
        >
          {monthTitle(month)}
        </Text>
        <IconButton
          icon={CaretRightIcon}
          accessibilityLabel="Mes siguiente"
          isDisabled={!canGoNext}
          onPress={() => {
            if (canGoNext) setMonth(nextMonth);
          }}
        />
      </View>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="flex-row justify-between"
      >
        {WEEKDAY_INITIALS.map((initial, index) => (
          <View
            key={`${initial}-${String(index)}`}
            testID="date-picker-weekday"
            className="size-12 items-center justify-center"
          >
            <Text className="font-medium text-xs text-muted">{initial}</Text>
          </View>
        ))}
      </View>
      {monthGrid(month).map((week, weekIndex) => (
        <View
          key={`${month}-${String(weekIndex)}`}
          testID="date-picker-week"
          className="flex-row justify-between"
        >
          {week.map((day, dayIndex) => (
            <DayCell
              key={day ?? `blank-${String(dayIndex)}`}
              day={day}
              value={value}
              maxDate={maxDate}
              today={today}
              onPick={pick}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Month calendar in a bottom sheet to reach a day from weeks ago without pressing "Día
 * anterior" many times. Months run from Monday to Sunday (D-01); days after `maxDate` are
 * disabled and the next-month button stops at the month of `maxDate`; there is no minimum
 * date. Today has a `foreground` outline and the chosen day an accent fill plus the
 * `selected` state. Pressing a day reports it, announces it and closes the sheet.
 */
export function DatePickerSheet({ isOpen, title, onClose, ...calendar }: DatePickerSheetProps) {
  return (
    <Sheet isOpen={isOpen} title={title} onClose={onClose}>
      <MonthCalendar {...calendar} onClose={onClose} />
    </Sheet>
  );
}
