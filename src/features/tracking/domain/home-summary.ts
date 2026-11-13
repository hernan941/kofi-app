import type { Clp } from '@/shared/domain';
import type { SaleRecord } from '@/features/sales/domain';

import type { HomeRanges } from './periods';
import { compareTotals, recordsBetween, totalBetween, type PeriodComparison } from './totals';

/** Total de un período, el del tramo equivalente anterior y su comparación. */
export interface PeriodSummary {
  readonly total: Clp;
  readonly previousTotal: Clp;
  readonly comparison: PeriodComparison;
}

/** Resumen de Inicio: semana y mes hasta hoy. */
export interface HomeSummary {
  readonly week: PeriodSummary;
  readonly month: PeriodSummary;
  /** Registros del mes hasta hoy, para la ganancia. */
  readonly monthRecords: readonly SaleRecord[];
}

function summarize(
  records: readonly SaleRecord[],
  current: HomeRanges['weekToDate'],
  previous: HomeRanges['previousWeekSegment'],
): PeriodSummary {
  const total = totalBetween(records, current);
  const previousTotal = totalBetween(records, previous);
  return { total, previousTotal, comparison: compareTotals(total, previousTotal) };
}

/** Totales y comparaciones (D-19) de la semana y del mes para los registros del rango de consulta. */
export function homeSummary(records: readonly SaleRecord[], ranges: HomeRanges): HomeSummary {
  return {
    week: summarize(records, ranges.weekToDate, ranges.previousWeekSegment),
    month: summarize(records, ranges.monthToDate, ranges.previousMonthSegment),
    monthRecords: recordsBetween(records, ranges.monthToDate),
  };
}
