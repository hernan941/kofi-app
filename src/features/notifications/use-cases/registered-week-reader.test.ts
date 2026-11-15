import { createDataChanges } from '@/core/db/data-changes';
import { noSalesWeekOf } from '@/features/sales/domain';
import { date, makeSaleItem, makeSaleRecord } from '../../sales/domain/testing/sale-fixtures';
import { createInMemoryNoSalesWeekRepository } from '@/features/sales/testing/in-memory-no-sales-week-repository';
import { createInMemorySaleRepository } from '@/features/sales/testing/in-memory-sale-repository';
import { weekRangeOf } from '@/shared/domain';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { createRegisteredWeekReader } from './registered-week-reader';

const WEEK = weekRangeOf(date('2026-11-12'));

function setup() {
  const dataChanges = createDataChanges(new RecordingLogger());
  const sales = createInMemorySaleRepository({ dataChanges });
  const noSalesWeeks = createInMemoryNoSalesWeekRepository({ dataChanges });
  return { sales, noSalesWeeks, reader: createRegisteredWeekReader({ sales, noSalesWeeks }) };
}

describe('createRegisteredWeekReader', () => {
  it('is not registered when the week has nothing', async () => {
    await expect(setup().reader.isRegistered(WEEK)).resolves.toBe(false);
  });

  it('is registered when the week has an active sale with items', async () => {
    const { sales, reader } = setup();
    sales.saveSync(makeSaleRecord([makeSaleItem(1)], { soldOn: date('2026-11-11') }));

    await expect(reader.isRegistered(WEEK)).resolves.toBe(true);
  });

  it('ignores sales of other weeks', async () => {
    const { sales, reader } = setup();
    sales.saveSync(makeSaleRecord([makeSaleItem(1)], { soldOn: date('2026-11-09') }));
    sales.saveSync(makeSaleRecord([makeSaleItem(2)], { soldOn: date('2026-11-01') }));

    const nextWeek = weekRangeOf(date('2026-11-17'));
    await expect(reader.isRegistered(nextWeek)).resolves.toBe(false);
  });

  it('is not registered once the only sale is deleted', async () => {
    const { sales, reader } = setup();
    const record = makeSaleRecord([makeSaleItem(1)], { soldOn: date('2026-11-11') });
    sales.saveSync(record);
    sales.softDeleteSync(record.id, record.updatedAt);

    await expect(reader.isRegistered(WEEK)).resolves.toBe(false);
  });

  it('is registered when the week carries the "no vendí" mark', async () => {
    const { noSalesWeeks, reader } = setup();
    const marked = noSalesWeekOf(WEEK.start);
    if (!marked.ok) throw new Error('Expected a Monday.');
    noSalesWeeks.markSync(marked.value, makeSaleRecord().createdAt);

    await expect(reader.isRegistered(WEEK)).resolves.toBe(true);
  });

  it('is not registered after the mark is removed', async () => {
    const { noSalesWeeks, reader } = setup();
    const marked = noSalesWeekOf(WEEK.start);
    if (!marked.ok) throw new Error('Expected a Monday.');
    noSalesWeeks.markSync(marked.value, makeSaleRecord().createdAt);
    noSalesWeeks.unmarkSync(marked.value.id, makeSaleRecord().createdAt);

    await expect(reader.isRegistered(WEEK)).resolves.toBe(false);
  });
});
