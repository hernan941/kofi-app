import { useMemo } from 'react';

import type { SaleRecord } from '@/features/sales/domain';

import { approximateProfit, versionIdsNeedingCurrentCost, type ProfitSummary } from '../domain';
import { useCurrentCosts } from './use-current-costs';

/** Resultado de {@link useProfit}. */
export interface ProfitState {
  readonly isPending: boolean;
  readonly profit: ProfitSummary | null;
}

/**
 * Ganancia aproximada de unos registros ya cargados: pide el costo actual solo de las
 * versiones de ítems sin costo copiado y delega el cálculo en `approximateProfit`. Mientras
 * carga, o si los costos fallan, no hay ganancia: nunca bloquea la pantalla.
 */
export function useProfit(records: readonly SaleRecord[] | undefined): ProfitState {
  const ids = useMemo(() => versionIdsNeedingCurrentCost(records ?? []), [records]);
  const { isPending, isError, costs } = useCurrentCosts(ids);
  const profit = useMemo(
    () =>
      records === undefined || isPending || isError ? null : approximateProfit(records, costs),
    [records, isPending, isError, costs],
  );
  return { isPending: records === undefined || isPending, profit };
}
