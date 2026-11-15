import { useRef } from 'react';
import { Text, View } from 'react-native';

import { SALE_ERROR_MESSAGES, describeWeekRange } from '@/features/sales';
import type { SaleErrors } from '@/features/sales/domain';
import { addDays, weekRangeOf, type Result, type WeekRange } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';
import {
  CheckCircleIcon,
  Icon,
  InlineNotice,
  SecondaryButton,
  TextButton,
  useAppToast,
} from '@/shared/ui';

import { useWeekNoSales } from '../hooks/use-week-no-sales';

const DAYS_IN_WEEK = 7;

type WeekKind = 'current' | 'previous';

const COPY = {
  current: {
    title: 'Esta semana',
    markLabel: 'Marcar que no vendí esta semana',
    unmarkLabel: 'Desmarcar esta semana',
    marked: 'Listo, anotamos que esta semana no vendiste.',
    unmarked: 'Quitamos la marca de esta semana.',
    hasSales: 'Esta semana ya tiene ventas, así que no hace falta marcar "no vendí".',
  },
  previous: {
    title: 'La semana pasada',
    markLabel: 'Marcar que no vendí la semana pasada',
    unmarkLabel: 'Desmarcar la semana pasada',
    marked: 'Listo, anotamos que la semana pasada no vendiste.',
    unmarked: 'Quitamos la marca de la semana pasada.',
    hasSales: 'La semana pasada ya tiene ventas, así que no hace falta marcar "no vendí".',
  },
} as const;

function firstErrorMessage(errors: SaleErrors): string {
  return SALE_ERROR_MESSAGES[errors[0].code];
}

function WeekRow({ week, kind }: { readonly week: WeekRange; readonly kind: WeekKind }) {
  const { status, mark, unmark, isPending } = useWeekNoSales(week);
  const toast = useAppToast();
  const isBusy = useRef(false);
  const copy = COPY[kind];

  const run = async (
    work: () => Promise<Result<void, SaleErrors>>,
    success: string,
    failure: string,
  ) => {
    if (isBusy.current) return;
    isBusy.current = true;
    try {
      const result = await work();
      if (result.ok) toast.showSuccess(success);
      else toast.showError(firstErrorMessage(result.error));
    } catch {
      toast.showError(failure);
    } finally {
      isBusy.current = false;
    }
  };

  if (status === null || status === 'not_allowed') {
    return null;
  }
  return (
    <View className="gap-2">
      <Text className="font-medium text-base text-foreground">{copy.title}</Text>
      <Text className="text-sm text-muted">{describeWeekRange(week)}</Text>
      {status === 'markable' ? (
        <SecondaryButton
          label="Marcar que no vendí"
          accessibilityLabel={copy.markLabel}
          isDisabled={isPending}
          onPress={() => {
            void run(mark, copy.marked, 'No se pudo marcar. Inténtalo de nuevo.');
          }}
        />
      ) : null}
      {status === 'marked' ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Icon icon={CheckCircleIcon} size="md" color="accent" />
          <Text className="text-sm text-foreground">Marcada como &quot;no vendí&quot;</Text>
          <TextButton
            label="Desmarcar"
            accessibilityLabel={copy.unmarkLabel}
            isDisabled={isPending}
            onPress={() => {
              void run(unmark, copy.unmarked, 'No se pudo quitar la marca. Inténtalo de nuevo.');
            }}
          />
        </View>
      ) : null}
      {status === 'has_sales' ? <InlineNotice message={copy.hasSales} /> : null}
    </View>
  );
}

/**
 * Bloque "no vendí" del Calendario (3.3 del diseño de F5): una fila para esta semana y otra
 * para la pasada (D-18), con marcar, desmarcar o el texto de D-25 según el estado que decide
 * el dominio. Sin confirmación: se deshace con la acción contraria. Un toque repetido
 * mientras guarda se ignora.
 */
export function WeekNoSalesAction() {
  const today = useToday();
  const current = weekRangeOf(today);
  const previous = weekRangeOf(addDays(current.start, -DAYS_IN_WEEK));
  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text accessibilityRole="header" className="font-semibold text-base text-foreground">
          ¿Una semana sin ventas?
        </Text>
        <Text className="text-sm text-muted">Anotarla también cuenta para tu racha.</Text>
      </View>
      <WeekRow week={current} kind="current" />
      <WeekRow week={previous} kind="previous" />
    </View>
  );
}
