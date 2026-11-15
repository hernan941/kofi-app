import type { NoSalesWeekRepository, SaleRepository } from '@/features/sales';

import type { RegisteredWeekReader } from '../domain/ports';

/** Fuentes que consulta {@link createRegisteredWeekReader}. */
export interface RegisteredWeekReaderPorts {
  readonly sales: Pick<SaleRepository, 'activeWeekStartsBetween'>;
  readonly noSalesWeeks: Pick<NoSalesWeekRepository, 'listBetween'>;
}

/**
 * Una semana está registrada si tiene una venta activa con ítems o una marca de "no vendí"
 * activa. Lee las dos fuentes sin transacción: la reconciliación siguiente corrige cualquier
 * instante intermedio.
 */
export function createRegisteredWeekReader({
  sales,
  noSalesWeeks,
}: RegisteredWeekReaderPorts): RegisteredWeekReader {
  return {
    isRegistered: async (week) => {
      const [saleWeeks, marks] = await Promise.all([
        sales.activeWeekStartsBetween(week.start, week.end),
        noSalesWeeks.listBetween(week.start, week.end),
      ]);
      return saleWeeks.length > 0 || marks.length > 0;
    },
  };
}
