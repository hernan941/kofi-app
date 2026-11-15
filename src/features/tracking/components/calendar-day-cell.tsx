import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { LocalDate } from '@/shared/domain';
import { localDateParts } from '@/shared/domain';

import type { CalendarDay, IntensityLevel } from '../domain';
import { dayAccessibilityLabel } from './day-label';

/** Props of {@link CalendarDayCell}. */
export interface CalendarDayCellProps {
  readonly day: CalendarDay;
  /** `true` si la semana del día está marcada como "no vendí". */
  readonly weekMarked: boolean;
  readonly onOpenDay: (date: LocalDate) => void;
}

const DOT_COUNTS: readonly (readonly null[])[] = [[], [null], [null, null], [null, null, null]];

/** Los puntos de intensidad (D-41): 1, 2 o 3 según el nivel; sin nivel reserva su alto. */
function IntensityDots({ level }: { readonly level: IntensityLevel }) {
  return (
    <View
      testID={level === 0 ? undefined : `intensity-${String(level)}`}
      className="h-1.5 flex-row items-center gap-0.5"
    >
      {DOT_COUNTS[level]?.map((_, index) => (
        <View key={index} className="size-1.5 rounded-full bg-foreground" />
      ))}
    </View>
  );
}

function DayNumber({ day }: { readonly day: CalendarDay }) {
  const number = String(localDateParts(day.date).day);
  const tone = day.isFuture ? 'text-muted opacity-60' : 'text-foreground';
  return (
    <View
      className={`min-h-7 min-w-7 items-center justify-center rounded-full ${day.isToday ? 'border-2 border-foreground' : ''}`}
    >
      <Text
        maxFontSizeMultiplier={2}
        className={`text-sm ${day.isToday ? 'font-bold' : 'font-medium'} ${tone}`}
      >
        {number}
      </Text>
    </View>
  );
}

/**
 * Celda de un día de la cuadrícula (3.2 del diseño de F5): número, puntos de intensidad y
 * etiqueta accesible con la fecha y lo vendido. Los días de relleno quedan vacíos y ocultos al
 * lector; los futuros están deshabilitados (D-03). Se memoiza por día.
 */
export const CalendarDayCell = memo(function CalendarDayCell({
  day,
  weekMarked,
  onOpenDay,
}: CalendarDayCellProps) {
  if (!day.inMonth) {
    return (
      <View
        className="min-h-14 flex-1"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }
  const label = dayAccessibilityLabel(day, weekMarked);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={day.isFuture ? undefined : 'Abre el detalle del día'}
      accessibilityState={{ disabled: day.isFuture }}
      disabled={day.isFuture}
      onPress={() => {
        onOpenDay(day.date);
      }}
      className="min-h-14 flex-1 items-center justify-center gap-1 rounded-xl active:bg-surface"
    >
      <DayNumber day={day} />
      <IntensityDots level={day.level} />
    </Pressable>
  );
});
