import type { TableName } from '@/core/db/table-names';
import { saleRecordIdSchema, type Clp, type ProductVersionId } from '@/shared/domain';

import type { SaleRecord } from '../domain';
import {
  clp,
  date,
  epoch,
  fixtureId,
  makeSaleItem,
  makeSaleRecord,
  versionId,
} from '../domain/testing/sale-fixtures';
import type { SaleRecordWriter, SaleRepository } from './sale-repository';

/** Lo que la suite de contrato necesita de cada implementación. */
export interface SaleRepositoryHarness {
  readonly repository: SaleRepository & SaleRecordWriter;
  /** Un elemento por cada `DataChanges` emitido desde que se creó el harness. */
  readonly emitted: ReadonlySet<TableName>[];
  /** Deja listos el producto 1 con las versiones 1 a 6; las implementaciones sin llaves foráneas no hacen nada. */
  seedCatalog(): Promise<void>;
  /** Cambia el costo actual de una versión del catálogo. */
  changeVersionCost(id: ProductVersionId, cost: Clp | null): Promise<void>;
  /** Inserta un registro tal cual, también con `items` vacío (datos rotos), sin emitir. */
  seedRaw(record: SaleRecord): void;
  dispose(): void;
}

const T0 = epoch(1_700_000_000_000);
const T1 = epoch(1_700_000_100_000);
const T2 = epoch(1_700_000_200_000);

function recordId(n: number) {
  return saleRecordIdSchema.parse(fixtureId(4, n));
}

function record(n: number, soldOn: string, overrides: Partial<SaleRecord> = {}): SaleRecord {
  return makeSaleRecord([makeSaleItem(n)], { id: recordId(n), soldOn: date(soldOn), ...overrides });
}

/**
 * Suite de contrato de `SaleRepository` y `SaleRecordWriter`. La corren la implementación
 * Drizzle y el doble en memoria, para que el doble no mienta.
 */
export function runSaleRepositoryContract(
  createHarness: () => Promise<SaleRepositoryHarness> | SaleRepositoryHarness,
): void {
  let harness: SaleRepositoryHarness;
  let repository: SaleRepositoryHarness['repository'];

  beforeEach(async () => {
    harness = await createHarness();
    repository = harness.repository;
    await harness.seedCatalog();
    harness.emitted.length = 0;
  });

  afterEach(() => {
    harness.dispose();
  });

  describe('save and findById', () => {
    it('returns null for an unknown record', async () => {
      await expect(repository.findById(recordId(1))).resolves.toBeNull();
    });

    it('stores a new record and reads it back with the items ordered by position', async () => {
      const stored = makeSaleRecord(
        [
          makeSaleItem(2, { position: 1, quantity: 3, unitCost: clp(300) }),
          makeSaleItem(1, { position: 0, productVersionId: versionId(2) }),
        ],
        { channel: 'fair', note: 'Feria de otoño' },
      );

      await repository.save(stored);

      await expect(repository.findById(stored.id)).resolves.toEqual({
        ...stored,
        items: [stored.items[1], stored.items[0]],
      });
    });

    it('updates items by id: edits one, adds one and removes one', async () => {
      const original = makeSaleRecord([makeSaleItem(1), makeSaleItem(2), makeSaleItem(3)]);
      await repository.save(original);

      const edited: SaleRecord = {
        ...original,
        soldOn: date('2026-07-02'),
        note: 'Cambió',
        updatedAt: T1,
        items: [
          makeSaleItem(1),
          makeSaleItem(2, { quantity: 5, unitPrice: clp(2500) }),
          makeSaleItem(4, { position: 2 }),
        ],
      };
      await repository.save(edited);

      await expect(repository.findById(original.id)).resolves.toEqual(edited);
    });

    it('keeps the copied unit cost when the version cost changes later', async () => {
      const stored = makeSaleRecord([makeSaleItem(1, { unitCost: clp(300) })]);
      await repository.save(stored);

      await harness.changeVersionCost(versionId(1), clp(999));

      const found = await repository.findById(stored.id);
      expect(found?.items[0]?.unitCost).toBe(300);
    });

    it('rejects a record without items', () => {
      expect(() => {
        repository.saveSync(makeSaleRecord([]));
      }).toThrow();
    });
  });

  describe('listBetween', () => {
    it('includes both ends of the closed range and orders by date, creation and id', async () => {
      await repository.save(record(1, '2026-07-03'));
      await repository.save(record(2, '2026-07-01', { createdAt: T1 }));
      await repository.save(record(3, '2026-07-01', { createdAt: T0 }));
      await repository.save(record(4, '2026-06-30'));
      await repository.save(record(5, '2026-07-04'));

      const found = await repository.listBetween(date('2026-07-01'), date('2026-07-03'));

      expect(found.map((item) => item.id)).toEqual([recordId(3), recordId(2), recordId(1)]);
    });

    it('excludes deleted records', async () => {
      await repository.save(record(1, '2026-07-01'));
      await repository.save(record(2, '2026-07-01'));
      await repository.softDelete(recordId(1), T1);

      const found = await repository.listBetween(date('2026-07-01'), date('2026-07-01'));

      expect(found.map((item) => item.id)).toEqual([recordId(2)]);
    });

    it('does not return removed items', async () => {
      const original = makeSaleRecord([makeSaleItem(1), makeSaleItem(2)]);
      await repository.save(original);
      await repository.save({ ...original, updatedAt: T1, items: [makeSaleItem(1)] });

      const [found] = await repository.listBetween(date('2026-07-01'), date('2026-07-01'));

      expect(found?.items.map((item) => item.id)).toEqual([makeSaleItem(1).id]);
    });

    it('includes records without active items with an empty item list', async () => {
      harness.seedRaw(makeSaleRecord([], { id: recordId(9) }));

      const found = await repository.listBetween(date('2026-07-01'), date('2026-07-01'));

      expect(found).toEqual([expect.objectContaining({ id: recordId(9), items: [] })]);
    });
  });

  describe('listRecent', () => {
    async function saveSameDayRecords(): Promise<void> {
      await repository.save(record(1, '2026-07-01'));
      await repository.save(record(2, '2026-07-01'));
      await repository.save(record(3, '2026-07-01'));
      await repository.save(record(4, '2026-06-20'));
      await repository.save(record(5, '2026-07-02', { createdAt: T0 }));
    }

    it('orders from the newest and pages without duplicates or gaps', async () => {
      await saveSameDayRecords();

      const first = await repository.listRecent(2);
      expect(first.records.map((item) => item.id)).toEqual([recordId(5), recordId(3)]);
      expect(first.next).toEqual({ soldOn: '2026-07-01', createdAt: T0, id: recordId(3) });

      const second = await repository.listRecent(2, first.next ?? undefined);
      expect(second.records.map((item) => item.id)).toEqual([recordId(2), recordId(1)]);

      const third = await repository.listRecent(2, second.next ?? undefined);
      expect(third.records.map((item) => item.id)).toEqual([recordId(4)]);
      expect(third.next).toBeNull();
    });

    it('has no next page when the last page is exactly full', async () => {
      await repository.save(record(1, '2026-07-01'));
      await repository.save(record(2, '2026-07-02'));

      const page = await repository.listRecent(2);

      expect(page.records).toHaveLength(2);
      expect(page.next).toBeNull();
    });

    it('is empty without records and skips deleted ones', async () => {
      await expect(repository.listRecent(5)).resolves.toEqual({ records: [], next: null });
      await repository.save(record(1, '2026-07-01'));
      await repository.softDelete(recordId(1), T1);

      await expect(repository.listRecent(5)).resolves.toEqual({ records: [], next: null });
    });

    it('loads the items of each record in order', async () => {
      const stored = makeSaleRecord([makeSaleItem(2, { position: 1 }), makeSaleItem(1)]);
      await repository.save(stored);

      const page = await repository.listRecent(5);

      expect(page.records[0]?.items.map((item) => item.position)).toEqual([0, 1]);
    });
  });

  describe('softDelete', () => {
    it('hides the record and reports whether it existed', async () => {
      await repository.save(record(1, '2026-07-01'));

      expect(repository.softDeleteSync(recordId(1), T1)).toBe(true);
      expect(repository.softDeleteSync(recordId(1), T2)).toBe(false);
      expect(repository.softDeleteSync(recordId(2), T2)).toBe(false);
      await expect(repository.findById(recordId(1))).resolves.toBeNull();
      expect(repository.findByIdSync(recordId(1))).toBeNull();
    });

    it('resolves without error for an unknown record', async () => {
      await expect(repository.softDelete(recordId(7), T1)).resolves.toBeUndefined();
    });
  });

  describe('week starts and earliest date', () => {
    it('returns the Mondays of the weeks with sales, without repeats and ascending', async () => {
      await repository.save(record(1, '2026-07-02'));
      await repository.save(record(2, '2026-07-05'));
      await repository.save(record(3, '2026-07-06'));
      await repository.save(record(4, '2026-12-31'));
      await repository.save(record(5, '2027-01-03'));
      await repository.save(record(6, '2027-01-04'));

      const starts = await repository.activeWeekStartsBetween(
        date('2026-07-01'),
        date('2027-01-31'),
      );

      expect(starts).toEqual(['2026-06-29', '2026-07-06', '2026-12-28', '2027-01-04']);
    });

    it('respects the closed range', async () => {
      await repository.save(record(1, '2026-07-01'));
      await repository.save(record(2, '2026-07-10'));

      await expect(
        repository.activeWeekStartsBetween(date('2026-07-02'), date('2026-07-09')),
      ).resolves.toEqual([]);
      await expect(
        repository.activeWeekStartsBetween(date('2026-07-10'), date('2026-07-10')),
      ).resolves.toEqual(['2026-07-06']);
    });

    it('ignores deleted records and records without active items', async () => {
      await repository.save(record(1, '2026-07-01'));
      await repository.softDelete(recordId(1), T1);
      harness.seedRaw(makeSaleRecord([], { id: recordId(2), soldOn: date('2026-07-14') }));

      await expect(
        repository.activeWeekStartsBetween(date('2026-06-01'), date('2026-08-01')),
      ).resolves.toEqual([]);
    });

    it('returns the earliest date with sales, or null without any', async () => {
      await expect(repository.earliestSoldOn()).resolves.toBeNull();
      await repository.save(record(1, '2026-07-10'));
      await repository.save(record(2, '2026-03-05'));
      await repository.save(record(3, '2026-01-01'));
      await repository.softDelete(recordId(3), T1);
      harness.seedRaw(makeSaleRecord([], { id: recordId(4), soldOn: date('2025-01-01') }));

      await expect(repository.earliestSoldOn()).resolves.toBe('2026-03-05');
    });
  });

  describe('sync queries', () => {
    it('tells whether there are sales in a closed range, ignoring deleted and empty records', async () => {
      await repository.save(record(1, '2026-07-08'));
      await repository.save(record(2, '2026-07-20'));
      await repository.softDelete(recordId(2), T1);
      harness.seedRaw(makeSaleRecord([], { id: recordId(3), soldOn: date('2026-07-25') }));

      expect(repository.hasSalesBetweenSync(date('2026-07-08'), date('2026-07-08'))).toBe(true);
      expect(repository.hasSalesBetweenSync(date('2026-07-09'), date('2026-07-31'))).toBe(false);
    });

    it('remembers that a record existed even after it is deleted', async () => {
      expect(repository.hasAnyRecordEverSync()).toBe(false);
      await repository.save(record(1, '2026-07-01'));
      await repository.softDelete(recordId(1), T1);

      expect(repository.hasAnyRecordEverSync()).toBe(true);
    });
  });

  describe('DataChanges', () => {
    it('emits once with the record and item tables when creating', () => {
      repository.saveSync(record(1, '2026-07-01'));

      expect(harness.emitted).toEqual([new Set(['sale_records', 'sale_items'])]);
    });

    it('emits only the record table when just a record field changes', () => {
      const original = record(1, '2026-07-01');
      repository.saveSync(original);
      harness.emitted.length = 0;

      repository.saveSync({ ...original, note: 'Nueva', updatedAt: T1 });

      expect(harness.emitted).toEqual([new Set(['sale_records'])]);
    });

    it('emits only the item table when just the items change', () => {
      const original = record(1, '2026-07-01');
      repository.saveSync(original);
      harness.emitted.length = 0;

      repository.saveSync({
        ...original,
        items: [{ ...makeSaleItem(1), quantity: 4 }],
      });

      expect(harness.emitted).toEqual([new Set(['sale_items'])]);
    });

    it('does not emit when nothing changed', () => {
      const original = record(1, '2026-07-01');
      repository.saveSync(original);
      harness.emitted.length = 0;

      repository.saveSync(original);

      expect(harness.emitted).toEqual([]);
    });

    it('emits both tables when deleting a record and nothing for an unknown one', () => {
      repository.saveSync(record(1, '2026-07-01'));
      harness.emitted.length = 0;

      repository.softDeleteSync(recordId(1), T1);
      repository.softDeleteSync(recordId(1), T2);
      repository.softDeleteSync(recordId(8), T2);

      expect(harness.emitted).toEqual([new Set(['sale_records', 'sale_items'])]);
    });

    it('does not emit on reads', async () => {
      repository.saveSync(record(1, '2026-07-01'));
      harness.emitted.length = 0;

      await repository.findById(recordId(1));
      await repository.listRecent(5);
      await repository.listBetween(date('2026-07-01'), date('2026-07-31'));
      await repository.activeWeekStartsBetween(date('2026-07-01'), date('2026-07-31'));
      await repository.earliestSoldOn();
      repository.hasSalesBetweenSync(date('2026-07-01'), date('2026-07-31'));
      repository.hasAnyRecordEverSync();

      expect(harness.emitted).toEqual([]);
    });
  });
}
