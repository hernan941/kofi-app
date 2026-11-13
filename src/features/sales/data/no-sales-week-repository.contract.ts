import type { TableName } from '@/core/db/table-names';

import { noSalesWeekOf } from '../domain';
import { date, epoch } from '../domain/testing/sale-fixtures';
import type { NoSalesWeekRepository, NoSalesWeekWriter } from './sale-repository';

/** Lo que la suite de contrato necesita de cada implementación. */
export interface NoSalesWeekRepositoryHarness {
  readonly repository: NoSalesWeekRepository & NoSalesWeekWriter;
  /** Un elemento por cada `DataChanges` emitido desde que se creó el harness. */
  readonly emitted: ReadonlySet<TableName>[];
  dispose(): void;
}

const T0 = epoch(1_700_000_000_000);
const T1 = epoch(1_700_000_100_000);
const T2 = epoch(1_700_000_200_000);

function week(weekStart: string) {
  const result = noSalesWeekOf(date(weekStart));
  if (!result.ok) {
    throw new Error('Expected a Monday.');
  }
  return result.value;
}

/** Suite de contrato de las marcas de "no vendí"; la corren Drizzle y el doble en memoria. */
export function runNoSalesWeekRepositoryContract(
  createHarness: () => Promise<NoSalesWeekRepositoryHarness> | NoSalesWeekRepositoryHarness,
): void {
  let harness: NoSalesWeekRepositoryHarness;
  let repository: NoSalesWeekRepositoryHarness['repository'];

  beforeEach(async () => {
    harness = await createHarness();
    repository = harness.repository;
  });

  afterEach(() => {
    harness.dispose();
  });

  it('marks a week with its deterministic id and lists it', async () => {
    const marked = week('2026-07-06');

    await repository.mark(marked, T0);

    expect(repository.isMarkedSync(marked.id)).toBe(true);
    await expect(repository.listBetween(date('2026-07-06'), date('2026-07-06'))).resolves.toEqual([
      marked,
    ]);
  });

  it('lists only marks inside the closed range, ascending', async () => {
    await repository.mark(week('2026-07-13'), T0);
    await repository.mark(week('2026-07-06'), T0);
    await repository.mark(week('2026-06-29'), T0);
    await repository.mark(week('2026-07-20'), T0);

    const found = await repository.listBetween(date('2026-07-06'), date('2026-07-13'));

    expect(found.map((item) => item.weekStart)).toEqual(['2026-07-06', '2026-07-13']);
  });

  it('unmarks a week and hides it from the listing', async () => {
    const marked = week('2026-07-06');
    await repository.mark(marked, T0);

    await repository.unmark(marked.id, T1);

    expect(repository.isMarkedSync(marked.id)).toBe(false);
    await expect(repository.listBetween(date('2026-06-01'), date('2026-08-01'))).resolves.toEqual(
      [],
    );
  });

  it('marks again after unmarking reusing the same id', async () => {
    const marked = week('2026-07-06');
    await repository.mark(marked, T0);
    await repository.unmark(marked.id, T1);

    await repository.mark(marked, T2);

    const found = await repository.listBetween(date('2026-07-06'), date('2026-07-06'));
    expect(found).toEqual([marked]);
  });

  it('reports whether a write changed something', () => {
    const marked = week('2026-07-06');

    expect(repository.unmarkSync(marked.id, T0)).toBe(false);
    expect(repository.markSync(marked, T0)).toBe(true);
    expect(repository.markSync(marked, T1)).toBe(false);
    expect(repository.unmarkSync(marked.id, T1)).toBe(true);
    expect(repository.unmarkSync(marked.id, T2)).toBe(false);
    expect(repository.markSync(marked, T2)).toBe(true);
  });

  it('emits only the no_sales_weeks table and only when something changed', () => {
    const marked = week('2026-07-06');

    repository.unmarkSync(marked.id, T0);
    repository.markSync(marked, T0);
    repository.markSync(marked, T1);
    repository.isMarkedSync(marked.id);
    repository.unmarkSync(marked.id, T1);

    expect(harness.emitted).toEqual([new Set(['no_sales_weeks']), new Set(['no_sales_weeks'])]);
  });
}
