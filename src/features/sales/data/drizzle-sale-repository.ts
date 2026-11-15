import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type { AppDatabase } from '@/core/db/open';
import { productVersions } from '@/core/db/schema/product-versions';
import { saleItems } from '@/core/db/schema/sale-items';
import { saleRecords } from '@/core/db/schema/sale-records';
import type { TouchedTables } from '@/core/db/transaction';
import { isoWeekStart, type EpochMs, type LocalDate, type SaleRecordId } from '@/shared/domain';

import { diffItems, hasItems, type SaleItem, type SaleRecord } from '../domain';
import { runAsPromise } from '@/core/db/run-as-promise';
import type {
  SaleRecordCursor,
  SaleRecordPage,
  SaleRecordWriter,
  SaleRepository,
  SalesDatabaseAccess,
} from './sale-repository';

type RecordRow = typeof saleRecords.$inferSelect;
type ItemRow = typeof saleItems.$inferSelect;

const ID_CHUNK_SIZE = 500;

function toItem(row: ItemRow): SaleItem {
  return {
    id: row.id,
    productId: row.productId,
    productVersionId: row.productVersionId,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    unitCost: row.unitCost,
    position: row.position,
  };
}

function toRecord(row: RecordRow, items: readonly SaleItem[]): SaleRecord {
  return {
    id: row.id,
    soldOn: row.soldOn,
    channel: row.channel,
    note: row.note,
    items,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
}

function loadActiveItems(db: AppDatabase, recordIds: readonly SaleRecordId[]) {
  const itemsByRecord = new Map<SaleRecordId, SaleItem[]>();
  for (const ids of chunk(recordIds, ID_CHUNK_SIZE)) {
    const rows = db
      .select()
      .from(saleItems)
      .where(and(inArray(saleItems.saleRecordId, ids), isNull(saleItems.deletedAt)))
      .orderBy(asc(saleItems.position), asc(saleItems.id))
      .all();
    for (const row of rows) {
      const list = itemsByRecord.get(row.saleRecordId);
      if (list) {
        list.push(toItem(row));
      } else {
        itemsByRecord.set(row.saleRecordId, [toItem(row)]);
      }
    }
  }
  return itemsByRecord;
}

function loadRecords(db: AppDatabase, rows: readonly RecordRow[]): readonly SaleRecord[] {
  const items = loadActiveItems(
    db,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toRecord(row, items.get(row.id) ?? []));
}

function findRecord(db: AppDatabase, id: SaleRecordId): SaleRecord | null {
  const rows = db
    .select()
    .from(saleRecords)
    .where(and(eq(saleRecords.id, id), isNull(saleRecords.deletedAt)))
    .all();
  return loadRecords(db, rows)[0] ?? null;
}

function listBetween(db: AppDatabase, from: LocalDate, to: LocalDate): readonly SaleRecord[] {
  const rows = db
    .select()
    .from(saleRecords)
    .where(
      and(
        isNull(saleRecords.deletedAt),
        sql`${saleRecords.soldOn} >= ${from}`,
        sql`${saleRecords.soldOn} <= ${to}`,
      ),
    )
    .orderBy(asc(saleRecords.soldOn), asc(saleRecords.createdAt), asc(saleRecords.id))
    .all();
  return loadRecords(db, rows);
}

function listRecent(db: AppDatabase, limit: number, cursor?: SaleRecordCursor): SaleRecordPage {
  const rows = db
    .select()
    .from(saleRecords)
    .where(
      and(
        isNull(saleRecords.deletedAt),
        cursor === undefined
          ? undefined
          : sql`(${saleRecords.soldOn}, ${saleRecords.createdAt}, ${saleRecords.id}) < (${cursor.soldOn}, ${cursor.createdAt}, ${cursor.id})`,
      ),
    )
    .orderBy(desc(saleRecords.soldOn), desc(saleRecords.createdAt), desc(saleRecords.id))
    .limit(limit + 1)
    .all();
  const pageRows = rows.slice(0, limit);
  const last = pageRows[pageRows.length - 1];
  const next =
    rows.length > limit && last !== undefined
      ? { soldOn: last.soldOn, createdAt: last.createdAt, id: last.id }
      : null;
  return { records: loadRecords(db, pageRows), next };
}

function activeSalesPredicate() {
  return and(isNull(saleRecords.deletedAt), isNull(saleItems.deletedAt));
}

function activeSoldOnDates(
  db: AppDatabase,
  from: LocalDate,
  to: LocalDate,
  limit = -1,
): LocalDate[] {
  return db
    .selectDistinct({ soldOn: saleRecords.soldOn })
    .from(saleRecords)
    .innerJoin(saleItems, eq(saleItems.saleRecordId, saleRecords.id))
    .where(
      and(
        activeSalesPredicate(),
        sql`${saleRecords.soldOn} >= ${from}`,
        sql`${saleRecords.soldOn} <= ${to}`,
      ),
    )
    .orderBy(asc(saleRecords.soldOn))
    .limit(limit)
    .all()
    .map((row) => row.soldOn);
}

function earliestSoldOn(db: AppDatabase): LocalDate | null {
  const row = db
    .select({ soldOn: saleRecords.soldOn })
    .from(saleRecords)
    .innerJoin(saleItems, eq(saleItems.saleRecordId, saleRecords.id))
    .where(activeSalesPredicate())
    .orderBy(asc(saleRecords.soldOn))
    .limit(1)
    .get();
  return row?.soldOn ?? null;
}

function hasSalesBetween(db: AppDatabase, from: LocalDate, to: LocalDate): boolean {
  return activeSoldOnDates(db, from, to, 1).length > 0;
}

function assertItemsMatchVersions(db: AppDatabase, record: SaleRecord): void {
  const versionIds = [...new Set(record.items.map((item) => item.productVersionId))];
  const rows = db
    .select({ id: productVersions.id, productId: productVersions.productId })
    .from(productVersions)
    .where(inArray(productVersions.id, versionIds))
    .all();
  const productByVersion = new Map(rows.map((row) => [row.id, row.productId]));
  const mismatch = record.items.find(
    (item) => productByVersion.get(item.productVersionId) !== item.productId,
  );
  if (mismatch) {
    throw new Error(
      `Sale item ${mismatch.id} has product ${mismatch.productId}, which does not own version ${mismatch.productVersionId}.`,
    );
  }
}

function itemValues(item: SaleItem, recordId: SaleRecordId, at: EpochMs) {
  return {
    id: item.id,
    saleRecordId: recordId,
    productId: item.productId,
    productVersionId: item.productVersionId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unitCost: item.unitCost,
    position: item.position,
    updatedAt: at,
    deletedAt: null,
  };
}

function recordChanged(row: RecordRow, record: SaleRecord): boolean {
  return (
    row.soldOn !== record.soldOn ||
    row.channel !== record.channel ||
    row.note !== record.note ||
    row.updatedAt !== record.updatedAt
  );
}

function writeItems(db: AppDatabase, record: SaleRecord, before: readonly SaleItem[]): boolean {
  const diff = diffItems(before, record.items);
  for (const item of [...diff.inserted, ...diff.updated]) {
    const values = itemValues(item, record.id, record.updatedAt);
    const { id: _id, ...changes } = values;
    db.insert(saleItems)
      .values({ ...values, createdAt: record.updatedAt })
      .onConflictDoUpdate({ target: saleItems.id, set: changes })
      .run();
  }
  for (const id of diff.removed) {
    db.update(saleItems)
      .set({ deletedAt: record.updatedAt, updatedAt: record.updatedAt })
      .where(eq(saleItems.id, id))
      .run();
  }
  return diff.inserted.length + diff.updated.length + diff.removed.length > 0;
}

function saveRows(db: AppDatabase, touched: TouchedTables, record: SaleRecord): void {
  if (!hasItems(record)) {
    throw new Error(`Cannot save sale record ${record.id} without items.`);
  }
  assertItemsMatchVersions(db, record);
  const row = db.select().from(saleRecords).where(eq(saleRecords.id, record.id)).get();
  const before = row === undefined ? [] : (loadActiveItems(db, [record.id]).get(record.id) ?? []);
  if (row === undefined || recordChanged(row, record) || row.deletedAt !== null) {
    const values = {
      soldOn: record.soldOn,
      channel: record.channel,
      note: record.note,
      updatedAt: record.updatedAt,
      deletedAt: null,
    };
    db.insert(saleRecords)
      .values({ id: record.id, createdAt: record.createdAt, ...values })
      .onConflictDoUpdate({ target: saleRecords.id, set: values })
      .run();
    touched.add('sale_records');
  }
  if (writeItems(db, record, row?.deletedAt === null ? before : [])) {
    touched.add('sale_items');
  }
}

function softDeleteRows(
  db: AppDatabase,
  touched: TouchedTables,
  id: SaleRecordId,
  now: EpochMs,
): boolean {
  const row = db
    .select()
    .from(saleRecords)
    .where(and(eq(saleRecords.id, id), isNull(saleRecords.deletedAt)))
    .get();
  if (row === undefined) {
    return false;
  }
  db.update(saleRecords)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(saleRecords.id, id))
    .run();
  touched.add('sale_records');
  const active = db
    .select({ id: saleItems.id })
    .from(saleItems)
    .where(and(eq(saleItems.saleRecordId, id), isNull(saleItems.deletedAt)))
    .all();
  if (active.length > 0) {
    db.update(saleItems)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(saleItems.saleRecordId, id), isNull(saleItems.deletedAt)))
      .run();
    touched.add('sale_items');
  }
  return true;
}

/**
 * Implementación Drizzle de {@link SaleRepository} y {@link SaleRecordWriter} sobre la misma
 * conexión. Los métodos asíncronos pasan por `runAsPromise`; las escrituras y los métodos
 * síncronos pasan por `runInTransaction`, que se une a la transacción externa si existe.
 */
export function createDrizzleSaleRepository(
  access: SalesDatabaseAccess,
): SaleRepository & SaleRecordWriter {
  const { runInTransaction } = access;

  const repository: SaleRepository & SaleRecordWriter = {
    listBetween: (from, to) => runAsPromise(() => listBetween(access.db(), from, to)),
    listRecent: (limit, cursor) => runAsPromise(() => listRecent(access.db(), limit, cursor)),
    findById: (id) => runAsPromise(() => findRecord(access.db(), id)),
    save: (record) =>
      runAsPromise(() => {
        repository.saveSync(record);
      }),
    softDelete: (id, now) =>
      runAsPromise(() => {
        repository.softDeleteSync(id, now);
      }),
    activeWeekStartsBetween: (from, to) =>
      runAsPromise(() => [
        ...new Set(activeSoldOnDates(access.db(), from, to).map((date) => isoWeekStart(date))),
      ]),
    earliestSoldOn: () => runAsPromise(() => earliestSoldOn(access.db())),
    findByIdSync: (id) => runInTransaction((tx) => findRecord(tx, id)),
    saveSync: (record) => {
      runInTransaction((tx, touched) => {
        saveRows(tx, touched, record);
      });
    },
    softDeleteSync: (id, now) =>
      runInTransaction((tx, touched) => softDeleteRows(tx, touched, id, now)),
    hasSalesBetweenSync: (from, to) => runInTransaction((tx) => hasSalesBetween(tx, from, to)),
    hasAnyRecordEverSync: () =>
      runInTransaction(
        (tx) => tx.select({ id: saleRecords.id }).from(saleRecords).limit(1).get() !== undefined,
      ),
  };
  return repository;
}
