import { err, ok, weekRangeOf, type LocalDate, type Result } from '@/shared/domain';

import { noSalesWeekOf, noSalesWeekStatus, type SaleErrors } from '../domain';
import type { SalesCommandDeps } from './sales-command-deps';

/** Comando de marcar o desmarcar una semana. */
export interface NoSalesWeekCommand {
  readonly weekStart: LocalDate;
}

function run(deps: SalesCommandDeps, command: NoSalesWeekCommand): Result<void, SaleErrors> {
  const now = deps.clock.now();
  const today = deps.calendar.localDateOf(now);
  const week = noSalesWeekOf(command.weekStart);
  if (!week.ok) {
    return week;
  }
  const range = weekRangeOf(command.weekStart);
  const status = noSalesWeekStatus(
    {
      week: range,
      hasSales: deps.sales.hasSalesBetweenSync(range.start, range.end),
      isMarked: deps.noSalesWeeks.isMarkedSync(week.value.id),
    },
    today,
  );
  if (status === 'not_allowed') {
    return err([{ code: 'week_not_allowed', path: ['weekStart'] }]);
  }
  if (status === 'has_sales') {
    return err([{ code: 'week_has_sales', path: ['weekStart'] }]);
  }
  if (status === 'markable') {
    deps.noSalesWeeks.markSync(week.value, now);
  }
  return ok(undefined);
}

/**
 * Marca una semana como "no vendí" dentro de una transacción: verifica la ventana
 * (D-18) y que no tenga ventas (D-25) con los datos de ese mismo instante. Marcar una semana
 * ya marcada devuelve `ok` sin escribir ni emitir.
 */
export function markNoSales(
  deps: SalesCommandDeps,
  command: NoSalesWeekCommand,
): Promise<Result<void, SaleErrors>> {
  return deps.transactions.run(() => run(deps, command));
}
