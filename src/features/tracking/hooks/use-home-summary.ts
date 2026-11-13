import { useMemo } from 'react';

import { useToday } from '@/shared/lib/time/use-today';

import { homeRanges, homeSummary, type HomeSummary, type ProfitSummary } from '../domain';
import { useProfit } from './use-profit';
import { useSalesBetween } from './use-sales-between';

/** Estado de una carga de Inicio. */
export type LoadStatus = 'pending' | 'error' | 'ready';

/** Resultado de {@link useHomeSummary}; `summary` solo existe con `status: 'ready'`. */
export interface HomeSummaryState {
  readonly status: LoadStatus;
  readonly summary: HomeSummary | null;
  /** Ganancia del mes hasta hoy; `null` sin costos, mientras cargan o si fallan. */
  readonly profit: ProfitSummary | null;
  readonly refetch: () => void;
}

/**
 * Resumen de Inicio con una sola consulta: desde el día 1 del mes anterior hasta hoy cubre la
 * semana, el mes y sus tramos equivalentes (D-19). Se renueva al cambiar el día o la semana.
 */
export function useHomeSummary(): HomeSummaryState {
  const today = useToday();
  const ranges = useMemo(() => homeRanges(today), [today]);
  const query = useSalesBetween(ranges.fetch);
  const records = query.data;
  const summary = useMemo(
    () => (records === undefined ? null : homeSummary(records, ranges)),
    [records, ranges],
  );
  const { profit } = useProfit(summary?.monthRecords);
  const refetch = () => {
    void query.refetch();
  };
  if (query.isError) {
    return { status: 'error', summary: null, profit: null, refetch };
  }
  return { status: summary === null ? 'pending' : 'ready', summary, profit, refetch };
}
