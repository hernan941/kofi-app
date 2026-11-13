import type { DataChanges } from '@/core/db/data-changes';
import type { NoSalesWeekId } from '@/shared/domain';

import { runAsPromise } from '@/core/db/run-as-promise';
import type { NoSalesWeekRepository, NoSalesWeekWriter } from '../data/sale-repository';
import type { NoSalesWeek } from '../domain';

/** Opciones de {@link createInMemoryNoSalesWeekRepository}. */
export interface InMemoryNoSalesWeekRepositoryOptions {
  readonly dataChanges: DataChanges;
}

interface Stored {
  readonly week: NoSalesWeek;
  readonly deleted: boolean;
}

/**
 * Doble en memoria de `NoSalesWeekRepository & NoSalesWeekWriter`. Cumple la misma suite de
 * contrato que la implementación Drizzle y emite `DataChanges` solo si algo cambió.
 */
export function createInMemoryNoSalesWeekRepository({
  dataChanges,
}: InMemoryNoSalesWeekRepositoryOptions): NoSalesWeekRepository & NoSalesWeekWriter {
  const stored = new Map<NoSalesWeekId, Stored>();

  const changed = (): true => {
    dataChanges.emit(new Set(['no_sales_weeks']));
    return true;
  };

  const markSync: NoSalesWeekWriter['markSync'] = (week) => {
    if (stored.get(week.id)?.deleted === false) {
      return false;
    }
    stored.set(week.id, { week, deleted: false });
    return changed();
  };

  const unmarkSync: NoSalesWeekWriter['unmarkSync'] = (id) => {
    const entry = stored.get(id);
    if (!entry || entry.deleted) {
      return false;
    }
    stored.set(id, { week: entry.week, deleted: true });
    return changed();
  };

  return {
    listBetween: (from, to) =>
      runAsPromise(() =>
        [...stored.values()]
          .filter((entry) => !entry.deleted)
          .map((entry) => entry.week)
          .filter((week) => week.weekStart >= from && week.weekStart <= to)
          .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)),
      ),
    mark: (week, now) =>
      runAsPromise(() => {
        markSync(week, now);
      }),
    unmark: (id, now) =>
      runAsPromise(() => {
        unmarkSync(id, now);
      }),
    isMarkedSync: (id) => stored.get(id)?.deleted === false,
    markSync,
    unmarkSync,
  };
}
