import { useQuery } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { NoSalesWeek, SaleRecord } from '@/features/sales/domain';
import { monthGridRange, type YearMonth } from '@/shared/domain';
import { useToday } from '@/shared/lib/time/use-today';

import { buildCalendarMonth, type CalendarMonth } from '../domain';
import { trackingKeys } from './query-keys';
import type { LoadStatus } from './use-home-summary';

/** Resultado de {@link useCalendarMonth}; `calendar` solo existe con `status: 'ready'`. */
export interface CalendarMonthState {
  readonly status: LoadStatus;
  readonly calendar: CalendarMonth | null;
  readonly refetch: () => void;
}

interface CalendarSource {
  readonly records: readonly SaleRecord[];
  readonly marks: readonly NoSalesWeek[];
}

/**
 * Mes del calendario con una sola consulta (ventas y marcas en paralelo) sobre el rango de su
 * cuadrícula. La clave no depende de hoy: `useToday` solo entra en `select`, así que al pasar
 * la medianoche se recalcula "hoy" sin volver a leer.
 */
export function useCalendarMonth(month: YearMonth): CalendarMonthState {
  const { sales, noSalesWeeks } = useDependencies();
  const today = useToday();
  const range = monthGridRange(month);
  const select = ({ records, marks }: CalendarSource) =>
    buildCalendarMonth(month, today, records, marks);
  const query = useQuery({
    queryKey: trackingKeys.calendar(range.start, range.end),
    queryFn: async (): Promise<CalendarSource> => {
      const [records, marks] = await Promise.all([
        sales.listBetween(range.start, range.end),
        noSalesWeeks.listBetween(range.start, range.end),
      ]);
      return { records, marks };
    },
    select,
  });
  const refetch = () => {
    void query.refetch();
  };
  if (query.isError) {
    return { status: 'error', calendar: null, refetch };
  }
  return {
    status: query.data === undefined ? 'pending' : 'ready',
    calendar: query.data ?? null,
    refetch,
  };
}
