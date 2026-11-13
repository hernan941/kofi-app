import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { noSalesWeeks } from '@/core/db/schema/no-sales-weeks';

import { runAsPromise } from '@/core/db/run-as-promise';
import type {
  NoSalesWeekRepository,
  NoSalesWeekWriter,
  SalesDatabaseAccess,
} from './sale-repository';

/**
 * Implementación Drizzle de {@link NoSalesWeekRepository} y {@link NoSalesWeekWriter}. Marcar
 * una semana desmarcada reactiva la misma fila, así que nunca hay dos filas por semana.
 */
export function createDrizzleNoSalesWeekRepository(
  access: SalesDatabaseAccess,
): NoSalesWeekRepository & NoSalesWeekWriter {
  const { runInTransaction } = access;

  const repository: NoSalesWeekRepository & NoSalesWeekWriter = {
    listBetween: (from, to) =>
      runAsPromise(() =>
        access
          .db()
          .select({ id: noSalesWeeks.id, weekStart: noSalesWeeks.weekStart })
          .from(noSalesWeeks)
          .where(
            and(
              isNull(noSalesWeeks.deletedAt),
              sql`${noSalesWeeks.weekStart} >= ${from}`,
              sql`${noSalesWeeks.weekStart} <= ${to}`,
            ),
          )
          .orderBy(asc(noSalesWeeks.weekStart))
          .all(),
      ),
    mark: (week, now) =>
      runAsPromise(() => {
        repository.markSync(week, now);
      }),
    unmark: (id, now) =>
      runAsPromise(() => {
        repository.unmarkSync(id, now);
      }),
    isMarkedSync: (id) =>
      runInTransaction(
        (tx) =>
          tx
            .select({ id: noSalesWeeks.id })
            .from(noSalesWeeks)
            .where(and(eq(noSalesWeeks.id, id), isNull(noSalesWeeks.deletedAt)))
            .get() !== undefined,
      ),
    markSync: (week, now) =>
      runInTransaction((tx, touched) => {
        const row = tx.select().from(noSalesWeeks).where(eq(noSalesWeeks.id, week.id)).get();
        if (row === undefined) {
          tx.insert(noSalesWeeks)
            .values({ id: week.id, weekStart: week.weekStart, createdAt: now, updatedAt: now })
            .run();
        } else if (row.deletedAt !== null) {
          tx.update(noSalesWeeks)
            .set({ deletedAt: null, updatedAt: now })
            .where(eq(noSalesWeeks.id, week.id))
            .run();
        } else {
          return false;
        }
        touched.add('no_sales_weeks');
        return true;
      }),
    unmarkSync: (id, now) =>
      runInTransaction((tx, touched) => {
        const row = tx.select().from(noSalesWeeks).where(eq(noSalesWeeks.id, id)).get();
        if (row?.deletedAt !== null) {
          return false;
        }
        tx.update(noSalesWeeks)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(noSalesWeeks.id, id))
          .run();
        touched.add('no_sales_weeks');
        return true;
      }),
  };
  return repository;
}
