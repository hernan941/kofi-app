import { act, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DataChangesBridge } from '@/core/providers/query/data-changes-bridge';
import { QUERY_DEPENDENCIES } from '@/core/providers/query/query-dependencies';
import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import {
  clp,
  date,
  fixtureId,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
} from '@/features/sales/testing/sale-fixtures';
import { epochMsSchema, saleRecordIdSchema, yearMonthSchema } from '@/shared/domain';
import { advanceClockAndTimers } from '@/shared/domain/testing/advance-clock-and-timers';

import { useEarliestSaleMonth } from './use-earliest-sale-month';
import { useHomeSummary } from './use-home-summary';
import { useLatestSales } from './use-latest-sales';
import { useMonthlySummary } from './use-monthly-summary';
import { useProfit } from './use-profit';
import { useStreak } from './use-streak';

const at = (iso: string) => epochMsSchema.parse(Date.parse(iso));
const month = (text: string) => yearMonthSchema.parse(text);

function recordId(n: number) {
  return saleRecordIdSchema.parse(fixtureId(4, n));
}

function seedSale(
  dependencies: TestDependencies,
  n: number,
  soldOn: string,
  unitPrice: number,
  versionN = 1,
) {
  dependencies.sales.saveSync(
    makeSaleRecord(
      [makeSaleItem(n, { unitPrice: clp(unitPrice), productVersionId: makeVersion(versionN).id })],
      { id: recordId(n), soldOn: date(soldOn) },
    ),
  );
}

function dependenciesWithCatalog(): TestDependencies {
  const dependencies = createTestDependencies();
  dependencies.products.saveSync(makeProduct(1, [makeVersion(1)], { name: 'Lámina' }));
  return dependencies;
}

function mount(element: React.ReactElement, dependencies: TestDependencies) {
  return renderWithProviders(
    <>
      <DataChangesBridge dataChanges={dependencies.dataChanges} dependencies={QUERY_DEPENDENCIES} />
      {element}
    </>,
    { dependencies },
  );
}

describe('useHomeSummary', () => {
  function HomeProbe() {
    const { status, summary, profit } = useHomeSummary();
    return (
      <Text>
        {status}|{String(summary?.week.total)}|{String(summary?.month.total)}|
        {profit === null ? 'no-profit' : String(profit.profit)}
      </Text>
    );
  }

  it('asks for a single range from the first day of the previous month until today', async () => {
    const dependencies = dependenciesWithCatalog();
    const listBetween = jest.spyOn(dependencies.sales, 'listBetween');

    await mount(<HomeProbe />, dependencies);
    await screen.findByText(/^ready/);

    expect(listBetween).toHaveBeenCalledTimes(1);
    expect(listBetween).toHaveBeenCalledWith('2026-06-01', '2026-07-01');
  });

  it('computes the totals of the week and of the month in the domain', async () => {
    const dependencies = dependenciesWithCatalog();
    seedSale(dependencies, 1, '2026-07-01', 5000);
    seedSale(dependencies, 2, '2026-06-30', 2000);
    seedSale(dependencies, 3, '2026-06-10', 9000);

    await mount(<HomeProbe />, dependencies);

    expect(await screen.findByText('ready|7000|5000|no-profit')).toBeOnTheScreen();
  });

  it('refreshes after a sale is saved', async () => {
    const dependencies = dependenciesWithCatalog();
    await mount(<HomeProbe />, dependencies);
    await screen.findByText('ready|0|0|no-profit');

    await act(async () => {
      dependencies.saleWriter.saveSync(
        makeSaleRecord([makeSaleItem(1, { unitPrice: clp(4000) })], {
          id: recordId(1),
          soldOn: date('2026-07-01'),
        }),
      );
      await Promise.resolve();
    });

    expect(await screen.findByText('ready|4000|4000|no-profit')).toBeOnTheScreen();
  });

  it('does not reload sales when a tip is viewed', async () => {
    const dependencies = dependenciesWithCatalog();
    const listBetween = jest.spyOn(dependencies.sales, 'listBetween');
    await mount(<HomeProbe />, dependencies);
    await screen.findByText(/^ready/);

    await act(async () => {
      dependencies.dataChanges.emit(new Set(['tip_views']));
      await Promise.resolve();
    });

    expect(listBetween).toHaveBeenCalledTimes(1);
  });

  it('shows the profit when a cost is loaded, without reloading the sales', async () => {
    const dependencies = dependenciesWithCatalog();
    seedSale(dependencies, 1, '2026-07-01', 5000);
    const listBetween = jest.spyOn(dependencies.sales, 'listBetween');
    await mount(<HomeProbe />, dependencies);
    await screen.findByText('ready|5000|5000|no-profit');

    await act(async () => {
      dependencies.productWriter.saveSync(
        makeProduct(1, [makeVersion(1, { cost: clp(2000) })], { name: 'Lámina' }),
      );
      await Promise.resolve();
    });

    expect(await screen.findByText('ready|5000|5000|3000')).toBeOnTheScreen();
    expect(listBetween).toHaveBeenCalledTimes(1);
  });

  it('moves to the new week when the clock passes Sunday midnight', async () => {
    jest.useFakeTimers();
    try {
      const dependencies = dependenciesWithCatalog();
      dependencies.clock.set(at('2026-07-05T23:59:00-04:00'));
      seedSale(dependencies, 1, '2026-07-05', 5000);
      await mount(<HomeProbe />, dependencies);
      await screen.findByText('ready|5000|5000|no-profit');

      await act(() => {
        advanceClockAndTimers(dependencies.clock, 2 * 60 * 1000);
      });

      await waitFor(() => {
        expect(screen.getByText('ready|0|5000|no-profit')).toBeOnTheScreen();
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('useProfit', () => {
  function ProfitProbe({ records }: { readonly records: Parameters<typeof useProfit>[0] }) {
    const { isPending, profit } = useProfit(records);
    return (
      <Text>{`${isPending ? 'pending' : 'done'}|${profit === null ? 'none' : String(profit.profit)}`}</Text>
    );
  }

  it('asks for current costs only for items without a copied cost', async () => {
    const dependencies = dependenciesWithCatalog();
    const currentCostsFor = jest.spyOn(dependencies.products, 'currentCostsFor');
    const records = [
      makeSaleRecord([
        makeSaleItem(1, { productVersionId: makeVersion(1).id, unitCost: null }),
        makeSaleItem(2, { productVersionId: makeVersion(2).id, unitCost: clp(300) }),
      ]),
    ];

    await mount(<ProfitProbe records={records} />, dependencies);
    await screen.findByText(/^done/);

    expect(currentCostsFor).toHaveBeenCalledTimes(1);
    expect(currentCostsFor).toHaveBeenCalledWith([makeVersion(1).id]);
  });

  it('does not ask when every item already has its cost', async () => {
    const dependencies = dependenciesWithCatalog();
    const currentCostsFor = jest.spyOn(dependencies.products, 'currentCostsFor');
    const records = [makeSaleRecord([makeSaleItem(1, { unitCost: clp(300) })])];

    await mount(<ProfitProbe records={records} />, dependencies);

    expect(await screen.findByText('done|700')).toBeOnTheScreen();
    expect(currentCostsFor).not.toHaveBeenCalled();
  });

  it('is pending without records and has no profit', async () => {
    await mount(<ProfitProbe records={undefined} />, dependenciesWithCatalog());

    expect(screen.getByText('pending|none')).toBeOnTheScreen();
  });
});

describe('useLatestSales', () => {
  function LatestProbe() {
    const { status, sales } = useLatestSales();
    return (
      <Text>
        {status}|
        {sales.map((view) => `${view.items[0]?.productName ?? '?'}:${view.total}`).join(',')}
      </Text>
    );
  }

  it('lists the latest sales with the current product name', async () => {
    const dependencies = dependenciesWithCatalog();
    seedSale(dependencies, 1, '2026-06-20', 1000);
    seedSale(dependencies, 2, '2026-07-01', 2500);

    await mount(<LatestProbe />, dependencies);

    expect(await screen.findByText('ready|Lámina:2500,Lámina:1000')).toBeOnTheScreen();
  });

  it('is ready and empty without sales', async () => {
    await mount(<LatestProbe />, dependenciesWithCatalog());

    expect(await screen.findByText('ready|')).toBeOnTheScreen();
  });

  it('asks for at most five records', async () => {
    const dependencies = dependenciesWithCatalog();
    const listRecent = jest.spyOn(dependencies.sales, 'listRecent');

    await mount(<LatestProbe />, dependencies);
    await screen.findByText(/^ready/);

    expect(listRecent).toHaveBeenCalledWith(5);
  });
});

describe('useMonthlySummary', () => {
  function MonthlyProbe({ target }: { readonly target: ReturnType<typeof month> }) {
    const { status, summary, topProductNames } = useMonthlySummary(target);
    return (
      <Text>
        {status}|{String(summary?.total)}|
        {topProductNames
          .map((top) => `${String(top.name)}:${top.isArchived ? 'a' : 'v'}`)
          .join(',')}
      </Text>
    );
  }

  it('summarizes the month and names the top product with its current name', async () => {
    const dependencies = dependenciesWithCatalog();
    seedSale(dependencies, 1, '2026-06-10', 4000);
    seedSale(dependencies, 2, '2026-05-10', 9000);

    await mount(<MonthlyProbe target={month('2026-06')} />, dependencies);

    expect(await screen.findByText('ready|4000|Lámina:v')).toBeOnTheScreen();
  });

  it('asks for the sales of that month only', async () => {
    const dependencies = dependenciesWithCatalog();
    const listBetween = jest.spyOn(dependencies.sales, 'listBetween');

    await mount(<MonthlyProbe target={month('2026-02')} />, dependencies);
    await screen.findByText(/^ready/);

    expect(listBetween).toHaveBeenCalledWith('2026-02-01', '2026-02-28');
  });

  it('marks an archived top product', async () => {
    const dependencies = createTestDependencies();
    dependencies.products.saveSync(
      makeProduct(1, [makeVersion(1)], { name: 'Lámina', archivedAt: at('2026-06-20T00:00:00Z') }),
    );
    seedSale(dependencies, 1, '2026-06-10', 4000);

    await mount(<MonthlyProbe target={month('2026-06')} />, dependencies);

    expect(await screen.findByText('ready|4000|Lámina:a')).toBeOnTheScreen();
  });
});

describe('useEarliestSaleMonth', () => {
  function EarliestProbe() {
    const { data } = useEarliestSaleMonth();
    return <Text>{String(data)}</Text>;
  }

  it('is the month of the oldest sale', async () => {
    const dependencies = dependenciesWithCatalog();
    seedSale(dependencies, 1, '2026-03-15', 1000);
    seedSale(dependencies, 2, '2026-06-10', 1000);

    await mount(<EarliestProbe />, dependencies);

    expect(await screen.findByText('2026-03')).toBeOnTheScreen();
  });

  it('is null without sales', async () => {
    await mount(<EarliestProbe />, dependenciesWithCatalog());

    expect(await screen.findByText('null')).toBeOnTheScreen();
  });
});

describe('useStreak', () => {
  function StreakProbe() {
    const { data } = useStreak();
    return <Text>{data === undefined ? 'loading' : String(data.weeks)}</Text>;
  }

  it('counts the weeks in a row up to the current one', async () => {
    const dependencies = dependenciesWithCatalog();
    seedSale(dependencies, 1, '2026-07-01', 1000);
    seedSale(dependencies, 2, '2026-06-24', 1000);

    await mount(<StreakProbe />, dependencies);

    expect(await screen.findByText('2')).toBeOnTheScreen();
  });
});
