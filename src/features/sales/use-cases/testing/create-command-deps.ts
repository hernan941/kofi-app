import { deviceLocalCalendar } from '@/shared/domain/calendar/device-local-calendar';
import type { LocalDate } from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';

import {
  createSalesTestContext,
  type SalesTestContext,
} from '../../data/testing/create-sales-test-context';
import { clp, date, makeProduct, makeVersion } from '../../domain/testing/sale-fixtures';
import type { SalesCommandDeps } from '../sales-command-deps';

/** Contexto de un test de casos de uso: base real, dependencias y reloj controlable. */
export interface CommandTestContext extends SalesTestContext {
  readonly deps: SalesCommandDeps;
  readonly clock: FakeClock;
}

/**
 * Crea la base con el producto 1 (versión 1 de $1.000 con costo $300, versión 2 a convenir)
 * y las dependencias de los casos de uso con el reloj en el mediodía local de `today`.
 */
export async function createCommandTestContext(today: LocalDate): Promise<CommandTestContext> {
  const context = await createSalesTestContext();
  context.addProduct(
    makeProduct(1, [
      makeVersion(1, { cost: clp(300) }),
      makeVersion(2, { pricing: { mode: 'negotiable' } }),
    ]),
  );
  const clock = new FakeClock(deviceLocalCalendar.instantAt(today, 12 * 60));
  const deps: SalesCommandDeps = {
    transactions: context.database.transactions,
    sales: context.sales,
    noSalesWeeks: context.noSalesWeeks,
    products: context.products,
    clock,
    calendar: deviceLocalCalendar,
    ids: new SequentialIdGenerator(),
  };
  return { ...context, deps, clock };
}

/** Hoy en los tests de casos de uso: un martes. */
export const TODAY = date('2023-11-14');
