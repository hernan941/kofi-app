import type { LocalDate, Result } from '@/shared/domain';

import { noSalesWeekOf, type SaleErrors } from '../domain';
import { date, makeItemInput, productId, versionId } from '../domain/testing/sale-fixtures';
import {
  saveSaleRecord,
  type SaveSaleRecordCommand,
  type SaveSaleRecordResult,
} from './save-sale-record';
import {
  TODAY,
  createCommandTestContext,
  type CommandTestContext,
} from './testing/create-command-deps';

let context: CommandTestContext;

beforeEach(async () => {
  context = await createCommandTestContext(TODAY);
});

afterEach(() => {
  context.database.close();
});

const THIS_MONDAY = date('2023-11-13');
const LAST_MONDAY = date('2023-11-06');

function createCommand(soldOn: LocalDate = TODAY, itemCount = 1): SaveSaleRecordCommand {
  return {
    kind: 'create',
    input: {
      soldOn,
      channel: null,
      note: null,
      items: Array.from({ length: itemCount }, () => makeItemInput(1)),
    },
  };
}

function markWeek(weekStart: LocalDate): void {
  const week = noSalesWeekOf(weekStart);
  if (!week.ok) {
    throw new Error('Expected a Monday.');
  }
  context.noSalesWeeks.markSync(week.value, context.clock.now());
  context.emitted.length = 0;
}

function saved(result: Result<SaveSaleRecordResult, SaleErrors>) {
  if (!result.ok || result.value.kind !== 'saved') {
    throw new Error('Expected a saved record.');
  }
  return result.value.outcome;
}

function codes(result: Result<unknown, SaleErrors>): readonly string[] {
  return result.ok ? [] : result.error.map((error) => error.code);
}

describe('saveSaleRecord', () => {
  it('creates a record, copies the version cost and emits once', async () => {
    const outcome = saved(await saveSaleRecord(context.deps, createCommand()));

    const stored = await context.sales.findById(outcome.recordId);
    expect(stored?.items).toEqual([
      expect.objectContaining({ productId: productId(1), unitPrice: 1000, unitCost: 300 }),
    ]);
    expect(outcome).toMatchObject({ kind: 'created', soldOn: TODAY, clearedNoSalesWeek: null });
    expect(context.emitted).toEqual([new Set(['sale_records', 'sale_items'])]);
  });

  it('removes the no-sales mark of the week and emits a single DataChanges (D-02)', async () => {
    markWeek(THIS_MONDAY);

    const outcome = saved(await saveSaleRecord(context.deps, createCommand()));

    expect(outcome.clearedNoSalesWeek).toBe(THIS_MONDAY);
    expect(await context.noSalesWeeks.listBetween(THIS_MONDAY, THIS_MONDAY)).toEqual([]);
    expect(context.emitted).toEqual([new Set(['sale_records', 'sale_items', 'no_sales_weeks'])]);
  });

  it('writes nothing and keeps the mark when an item write fails', async () => {
    markWeek(THIS_MONDAY);
    const failing = {
      ...context.deps,
      noSalesWeeks: {
        ...context.noSalesWeeks,
        unmarkSync: (...args: Parameters<typeof context.noSalesWeeks.unmarkSync>) => {
          context.noSalesWeeks.unmarkSync(...args);
          throw new Error('boom');
        },
      },
    };

    await expect(saveSaleRecord(failing, createCommand(TODAY, 2))).rejects.toThrow('boom');

    expect(await context.sales.listBetween(TODAY, TODAY)).toEqual([]);
    expect(await context.noSalesWeeks.listBetween(THIS_MONDAY, THIS_MONDAY)).toHaveLength(1);
    expect(context.emitted).toEqual([]);
  });

  it('removes the mark of the week an edit moves the record to', async () => {
    const outcome = saved(await saveSaleRecord(context.deps, createCommand(TODAY)));
    markWeek(LAST_MONDAY);
    const record = await context.sales.findById(outcome.recordId);
    if (record === null) throw new Error('missing');

    const result = await saveSaleRecord(context.deps, {
      kind: 'update',
      recordId: record.id,
      input: {
        soldOn: date('2023-11-08'),
        channel: null,
        note: null,
        items: record.items.map((item) => ({
          itemId: item.id,
          productId: item.productId,
          productVersionId: item.productVersionId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    });

    expect(saved(result)).toMatchObject({ kind: 'updated', clearedNoSalesWeek: LAST_MONDAY });
    expect(await context.noSalesWeeks.listBetween(LAST_MONDAY, LAST_MONDAY)).toEqual([]);
  });

  it('returns record_not_found when editing an unknown record', async () => {
    const result = await saveSaleRecord(context.deps, {
      kind: 'update',
      recordId: await saveAndGetId(),
      input: { soldOn: TODAY, channel: null, note: null, items: [makeItemInput(1)] },
    });
    expect(codes(result)).toEqual(['record_not_found']);
  });

  it('deletes the record when an edit removes every item', async () => {
    const outcome = saved(await saveSaleRecord(context.deps, createCommand()));

    const result = await saveSaleRecord(context.deps, {
      kind: 'update',
      recordId: outcome.recordId,
      input: { soldOn: TODAY, channel: null, note: null, items: [] },
    });

    expect(result).toEqual({ ok: true, value: { kind: 'deleted', recordId: outcome.recordId } });
    expect(await context.sales.findById(outcome.recordId)).toBeNull();
  });

  it('rejects a future date without writing or emitting', async () => {
    const result = await saveSaleRecord(context.deps, createCommand(date('2023-11-15')));

    expect(codes(result)).toEqual(['future_date']);
    expect(context.sales.hasAnyRecordEverSync()).toBe(false);
    expect(context.emitted).toEqual([]);
  });

  it('returns the domain errors for an unknown product', async () => {
    const result = await saveSaleRecord(context.deps, {
      kind: 'create',
      input: {
        soldOn: TODAY,
        channel: null,
        note: null,
        items: [makeItemInput(1, { productId: productId(9), productVersionId: versionId(9) })],
      },
    });

    expect(codes(result)).toEqual(['product_not_found']);
  });

  it('flags only the first record ever as the first sale, also after deleting everything', async () => {
    const first = saved(await saveSaleRecord(context.deps, createCommand()));
    const second = saved(await saveSaleRecord(context.deps, createCommand()));
    await context.sales.softDelete(first.recordId, context.clock.now());
    await context.sales.softDelete(second.recordId, context.clock.now());
    const third = saved(await saveSaleRecord(context.deps, createCommand()));

    expect([first.isFirstSale, second.isFirstSale, third.isFirstSale]).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('is never the first sale when editing', async () => {
    const created = saved(await saveSaleRecord(context.deps, createCommand()));
    const record = await context.sales.findById(created.recordId);
    if (record === null) throw new Error('missing');

    const edited = saved(
      await saveSaleRecord(context.deps, {
        kind: 'update',
        recordId: record.id,
        input: {
          soldOn: TODAY,
          channel: 'fair',
          note: null,
          items: record.items.map((item) => ({
            itemId: item.id,
            productId: item.productId,
            productVersionId: item.productVersionId,
            quantity: 2,
            unitPrice: item.unitPrice,
          })),
        },
      }),
    );

    expect(edited.isFirstSale).toBe(false);
  });
});

async function saveAndGetId() {
  const outcome = saved(await saveSaleRecord(context.deps, createCommand()));
  await context.sales.softDelete(outcome.recordId, context.clock.now());
  return outcome.recordId;
}
