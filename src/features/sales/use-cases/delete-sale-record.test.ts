import type { Result } from '@/shared/domain';

import { noSalesWeekOf, type SaleErrors } from '../domain';
import { date, makeItemInput } from '../domain/testing/sale-fixtures';
import { deleteSaleRecord } from './delete-sale-record';
import { saveSaleRecord } from './save-sale-record';
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

function codes(result: Result<unknown, SaleErrors>): readonly string[] {
  return result.ok ? [] : result.error.map((error) => error.code);
}

async function createRecord() {
  const result = await saveSaleRecord(context.deps, {
    kind: 'create',
    input: { soldOn: TODAY, channel: null, note: null, items: [makeItemInput(1)] },
  });
  if (!result.ok || result.value.kind !== 'saved') throw new Error('Expected a saved record.');
  context.emitted.length = 0;
  return result.value.outcome.recordId;
}

describe('deleteSaleRecord', () => {
  it('soft-deletes the record and its items and emits once', async () => {
    const id = await createRecord();

    const result = await deleteSaleRecord(context.deps, id);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(await context.sales.findById(id)).toBeNull();
    expect(context.emitted).toEqual([new Set(['sale_records', 'sale_items'])]);
  });

  it('does not recreate a no-sales mark', async () => {
    const id = await createRecord();

    await deleteSaleRecord(context.deps, id);

    expect(await context.noSalesWeeks.listBetween(date('2023-01-01'), date('2023-12-31'))).toEqual(
      [],
    );
    expect(context.emitted).not.toContainEqual(new Set(['no_sales_weeks']));
  });

  it('keeps an existing mark untouched', async () => {
    const id = await createRecord();
    const week = noSalesWeekOf(date('2023-11-06'));
    if (!week.ok) throw new Error('Monday expected');
    context.noSalesWeeks.markSync(week.value, context.clock.now());

    await deleteSaleRecord(context.deps, id);

    expect(context.noSalesWeeks.isMarkedSync(week.value.id)).toBe(true);
  });

  it('returns record_not_found for an unknown or already deleted record', async () => {
    const id = await createRecord();
    await deleteSaleRecord(context.deps, id);
    context.emitted.length = 0;

    expect(codes(await deleteSaleRecord(context.deps, id))).toEqual(['record_not_found']);
    expect(context.emitted).toEqual([]);
  });
});
