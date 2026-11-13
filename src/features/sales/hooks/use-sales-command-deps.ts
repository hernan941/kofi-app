import { useDependencies } from '@/core/providers/dependencies-context';

import type { SalesCommandDeps } from '../use-cases/sales-command-deps';

/** Puertos de los casos de uso de ventas, tomados de las dependencias de la app. */
export function useSalesCommandDeps(): SalesCommandDeps {
  const { transactions, saleWriter, noSalesWeekWriter, productWriter, clock, calendar, ids } =
    useDependencies();
  return {
    transactions,
    sales: saleWriter,
    noSalesWeeks: noSalesWeekWriter,
    products: productWriter,
    clock,
    calendar,
    ids,
  };
}
