import type { LocalDate, Result } from '@/shared/domain';

import { noSalesWeekId, type SaleErrors } from '../domain';
import { date, makeItemInput } from '../domain/testing/sale-fixtures';
import { markNoSales } from './mark-no-sales';
import { saveSaleRecord } from './save-sale-record';
import {
  TODAY,
  createCommandTestContext,
  type CommandTestContext,
} from './testing/create-command-deps';
import { unmarkNoSales } from './unmark-no-sales';

let context: CommandTestContext;

beforeEach(async () => {
  context = await createCommandTestContext(TODAY);
});

afterEach(() => {
  context.database.close();
});

const THIS_MONDAY = date('2023-11-13');
const LAST_MONDAY = date('2023-11-06');
const TWO_WEEKS_AGO = date('2023-10-30');

function codes(result: Result<unknown, SaleErrors>): readonly string[] {
  return result.ok ? [] : result.error.map((error) => error.code);
}

function isMarked(weekStart: LocalDate): boolean {
  return context.noSalesWeeks.isMarkedSync(noSalesWeekId(weekStart));
}

describe('markNoSales', () => {
  it('marks the current week and emits no_sales_weeks', async () => {
    const result = await markNoSales(context.deps, { weekStart: THIS_MONDAY });

    expect(result.ok).toBe(true);
    expect(isMarked(THIS_MONDAY)).toBe(true);
    expect(context.emitted).toEqual([new Set(['no_sales_weeks'])]);
  });

  it('allows the previous week', async () => {
    expect((await markNoSales(context.deps, { weekStart: LAST_MONDAY })).ok).toBe(true);
  });

  it('rejects a week two weeks back', async () => {
    const result = await markNoSales(context.deps, { weekStart: TWO_WEEKS_AGO });

    expect(codes(result)).toEqual(['week_not_allowed']);
    expect(context.emitted).toEqual([]);
  });

  it('rejects a date that is not a Monday', async () => {
    expect(codes(await markNoSales(context.deps, { weekStart: TODAY }))).toEqual([
      'not_a_week_start',
    ]);
  });

  it('rejects a week that already has sales, checked inside the transaction', async () => {
    await saveSaleRecord(context.deps, {
      kind: 'create',
      input: { soldOn: TODAY, channel: null, note: null, items: [makeItemInput(1)] },
    });
    context.emitted.length = 0;

    const result = await markNoSales(context.deps, { weekStart: THIS_MONDAY });

    expect(codes(result)).toEqual(['week_has_sales']);
    expect(isMarked(THIS_MONDAY)).toBe(false);
    expect(context.emitted).toEqual([]);
  });

  it('succeeds without writing or emitting when the week is already marked', async () => {
    await markNoSales(context.deps, { weekStart: THIS_MONDAY });
    context.emitted.length = 0;

    expect((await markNoSales(context.deps, { weekStart: THIS_MONDAY })).ok).toBe(true);
    expect(context.emitted).toEqual([]);
  });
});

describe('unmarkNoSales', () => {
  it('unmarks a marked week', async () => {
    await markNoSales(context.deps, { weekStart: THIS_MONDAY });
    context.emitted.length = 0;

    const result = await unmarkNoSales(context.deps, { weekStart: THIS_MONDAY });

    expect(result.ok).toBe(true);
    expect(isMarked(THIS_MONDAY)).toBe(false);
    expect(context.emitted).toEqual([new Set(['no_sales_weeks'])]);
  });

  it('can mark again after unmarking', async () => {
    await markNoSales(context.deps, { weekStart: THIS_MONDAY });
    await unmarkNoSales(context.deps, { weekStart: THIS_MONDAY });

    await markNoSales(context.deps, { weekStart: THIS_MONDAY });

    expect(isMarked(THIS_MONDAY)).toBe(true);
  });

  it('succeeds without emitting when the week is not marked', async () => {
    expect((await unmarkNoSales(context.deps, { weekStart: THIS_MONDAY })).ok).toBe(true);
    expect(context.emitted).toEqual([]);
  });

  it('rejects weeks outside the window and non-Mondays', async () => {
    expect(codes(await unmarkNoSales(context.deps, { weekStart: TWO_WEEKS_AGO }))).toEqual([
      'week_not_allowed',
    ]);
    expect(codes(await unmarkNoSales(context.deps, { weekStart: TODAY }))).toEqual([
      'week_not_allowed',
    ]);
  });
});
