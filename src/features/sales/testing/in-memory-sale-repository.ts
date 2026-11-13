import type { DataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';
import { isoWeekStart, type LocalDate, type SaleRecordId } from '@/shared/domain';

import { runAsPromise } from '@/core/db/run-as-promise';
import type { SaleRecordCursor, SaleRecordWriter, SaleRepository } from '../data/sale-repository';
import { diffItems, hasItems, type SaleItem, type SaleRecord } from '../domain';

/** Opciones de {@link createInMemorySaleRepository}. */
export interface InMemorySaleRepositoryOptions {
  readonly dataChanges: DataChanges;
}

/** Doble en memoria de los dos puertos de ventas, con una siembra directa para los tests. */
export interface InMemorySaleRepository extends SaleRepository, SaleRecordWriter {
  /** Inserta un registro tal cual, también sin ítems (datos rotos), sin emitir. */
  seed(record: SaleRecord): void;
}

interface Stored {
  readonly record: SaleRecord;
  readonly deleted: boolean;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareRecords(a: SaleRecord, b: SaleRecord): number {
  return compareText(a.soldOn, b.soldOn) || a.createdAt - b.createdAt || compareText(a.id, b.id);
}

function withSortedItems(record: SaleRecord): SaleRecord {
  const items = [...record.items].sort(
    (a: SaleItem, b: SaleItem) => a.position - b.position || compareText(a.id, b.id),
  );
  return { ...record, items };
}

function isBefore(record: SaleRecord, cursor: SaleRecordCursor): boolean {
  return (
    compareRecords(record, {
      ...record,
      soldOn: cursor.soldOn,
      createdAt: cursor.createdAt,
      id: cursor.id,
    }) < 0
  );
}

/**
 * Doble en memoria de `SaleRepository & SaleRecordWriter` para los tests de UI. Cumple la
 * misma suite de contrato que la implementación Drizzle y emite `DataChanges` en cada
 * escritura. No valida la pertenencia de los productos a sus versiones: no tiene catálogo.
 */
export function createInMemorySaleRepository({
  dataChanges,
}: InMemorySaleRepositoryOptions): InMemorySaleRepository {
  const stored = new Map<SaleRecordId, Stored>();

  const active = (): readonly SaleRecord[] =>
    [...stored.values()].filter((entry) => !entry.deleted).map((entry) => entry.record);

  const withSales = (): readonly SaleRecord[] => active().filter(hasItems);

  const inRange = (record: SaleRecord, from: LocalDate, to: LocalDate): boolean =>
    record.soldOn >= from && record.soldOn <= to;

  const find = (id: SaleRecordId): SaleRecord | null => {
    const entry = stored.get(id);
    return entry && !entry.deleted ? withSortedItems(entry.record) : null;
  };

  const emit = (tables: readonly TableName[]): void => {
    if (tables.length > 0) {
      dataChanges.emit(new Set(tables));
    }
  };

  const saveSync = (record: SaleRecord): void => {
    if (!hasItems(record)) {
      throw new Error(`Cannot save sale record ${record.id} without items.`);
    }
    const previous = stored.get(record.id);
    const before = previous?.deleted === false ? previous.record : null;
    const recordChanged =
      before?.soldOn !== record.soldOn ||
      before.channel !== record.channel ||
      before.note !== record.note ||
      before.updatedAt !== record.updatedAt;
    const diff = diffItems(before?.items ?? [], record.items);
    const itemsChanged = diff.inserted.length + diff.updated.length + diff.removed.length > 0;
    stored.set(record.id, { record, deleted: false });
    emit([
      ...(recordChanged ? (['sale_records'] as const) : []),
      ...(itemsChanged ? (['sale_items'] as const) : []),
    ]);
  };

  const softDeleteSync: SaleRecordWriter['softDeleteSync'] = (id) => {
    const entry = stored.get(id);
    if (!entry || entry.deleted) {
      return false;
    }
    stored.set(id, { record: entry.record, deleted: true });
    emit(hasItems(entry.record) ? ['sale_records', 'sale_items'] : ['sale_records']);
    return true;
  };

  const hasSalesBetween = (from: LocalDate, to: LocalDate): boolean =>
    withSales().some((record) => inRange(record, from, to));

  return {
    listBetween: (from, to) =>
      runAsPromise(() =>
        active()
          .filter((record) => inRange(record, from, to))
          .sort(compareRecords)
          .map(withSortedItems),
      ),
    listRecent: (limit, cursor) =>
      runAsPromise(() => {
        const ordered = active()
          .filter((record) => cursor === undefined || isBefore(record, cursor))
          .sort((a, b) => compareRecords(b, a));
        const records = ordered.slice(0, limit).map(withSortedItems);
        const last = records[records.length - 1];
        const next =
          ordered.length > limit && last !== undefined
            ? { soldOn: last.soldOn, createdAt: last.createdAt, id: last.id }
            : null;
        return { records, next };
      }),
    findById: (id) => runAsPromise(() => find(id)),
    save: (record) =>
      runAsPromise(() => {
        saveSync(record);
      }),
    softDelete: (id, now) =>
      runAsPromise(() => {
        softDeleteSync(id, now);
      }),
    activeWeekStartsBetween: (from, to) =>
      runAsPromise(() => [
        ...new Set(
          withSales()
            .filter((record) => inRange(record, from, to))
            .map((record) => record.soldOn)
            .sort(compareText)
            .map((date) => isoWeekStart(date)),
        ),
      ]),
    earliestSoldOn: () =>
      runAsPromise(
        () =>
          withSales()
            .map((record) => record.soldOn)
            .sort(compareText)[0] ?? null,
      ),
    findByIdSync: find,
    saveSync,
    softDeleteSync,
    hasSalesBetweenSync: hasSalesBetween,
    hasAnyRecordEverSync: () => stored.size > 0,
    seed: (record) => {
      stored.set(record.id, { record, deleted: false });
    },
  };
}
