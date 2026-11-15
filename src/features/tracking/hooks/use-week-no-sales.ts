import { useQuery } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import { useMarkNoSales, useUnmarkNoSales } from '@/features/sales';
import {
  noSalesWeekStatus,
  type NoSalesWeekStatus,
  type SaleErrors,
} from '@/features/sales/domain';
import type { Result, WeekRange } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';

import { weekFactsOf } from '../domain';
import { trackingKeys } from './query-keys';

/** Resultado de {@link useWeekNoSales}. */
export interface WeekNoSalesState {
  /** `null` mientras carga o si la lectura falla. */
  readonly status: NoSalesWeekStatus | null;
  /** Marca la semana; rechaza solo ante un fallo inesperado. */
  readonly mark: () => Promise<Result<void, SaleErrors>>;
  /** Quita la marca; rechaza solo ante un fallo inesperado. */
  readonly unmark: () => Promise<Result<void, SaleErrors>>;
  readonly isPending: boolean;
}

/**
 * Estado de "no vendí" de una semana (D-18 y D-25) con `noSalesWeekStatus` y sus propias
 * ventas y marcas, así que sirve aunque la semana no esté entera en la cuadrícula del mes. El
 * caso de uso vuelve a verificar todo dentro de la transacción; las escrituras invalidan
 * `['tracking']` solas.
 */
export function useWeekNoSales(week: WeekRange): WeekNoSalesState {
  const { sales, noSalesWeeks } = useDependencies();
  const today = useToday();
  const markMutation = useMarkNoSales();
  const unmarkMutation = useUnmarkNoSales();
  const query = useQuery({
    queryKey: trackingKeys.weekFacts(week.start),
    queryFn: async () => {
      const [records, marks] = await Promise.all([
        sales.listBetween(week.start, week.end),
        noSalesWeeks.listBetween(week.start, week.end),
      ]);
      return weekFactsOf(week, records, marks);
    },
  });
  return {
    status: query.data === undefined ? null : noSalesWeekStatus(query.data, today),
    mark: () => markMutation.mutateAsync({ weekStart: week.start }),
    unmark: () => unmarkMutation.mutateAsync({ weekStart: week.start }),
    isPending: markMutation.isPending || unmarkMutation.isPending,
  };
}
