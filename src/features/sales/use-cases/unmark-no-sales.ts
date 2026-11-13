import { err, ok, type Result } from '@/shared/domain';

import { canUnmarkNoSales, noSalesWeekId, type SaleErrors } from '../domain';
import type { NoSalesWeekCommand } from './mark-no-sales';
import type { SalesCommandDeps } from './sales-command-deps';

/**
 * Desmarca una semana dentro de una transacción si está en la ventana de la semana actual y la
 * anterior (`week_not_allowed`). Desmarcar una semana no marcada devuelve `ok` sin escribir.
 */
export function unmarkNoSales(
  deps: SalesCommandDeps,
  command: NoSalesWeekCommand,
): Promise<Result<void, SaleErrors>> {
  return deps.transactions.run(() => {
    const now = deps.clock.now();
    if (!canUnmarkNoSales(command.weekStart, deps.calendar.localDateOf(now))) {
      return err([{ code: 'week_not_allowed', path: ['weekStart'] }] as const);
    }
    deps.noSalesWeeks.unmarkSync(noSalesWeekId(command.weekStart), now);
    return ok(undefined);
  });
}
