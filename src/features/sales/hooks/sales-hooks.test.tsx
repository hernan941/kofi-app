import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DataChangesBridge } from '@/core/providers/query/data-changes-bridge';
import { QUERY_DEPENDENCIES } from '@/core/providers/query/query-dependencies';
import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { holdCalls } from '@/core/testing/hold-calls';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { epochMsSchema, type LocalDate, type SaleRecordId } from '@/shared/domain';
import { advanceClockAndTimers } from '@/shared/domain/testing/advance-clock-and-timers';

import type { SaleErrors } from '../domain';
import {
  date,
  fixtureId,
  makeItemInput,
  makeSaleItem,
  makeProduct as makeCatalogProduct,
  makeSaleRecord,
  makeVersion,
} from '../domain/testing/sale-fixtures';
import type { NoSalesWeekCommand } from '../use-cases/mark-no-sales';
import type { SaveSaleRecordCommand } from '../use-cases/save-sale-record';
import { saleRecordIdSchema } from '@/shared/domain';
import { useDeleteSaleRecord } from './use-delete-sale-record';
import { useMarkNoSales } from './use-mark-no-sales';
import { useNoSalesPrompt } from './use-no-sales-prompt';
import { useRecentSales } from './use-recent-sales';
import { useSaleRecord } from './use-sale-record';
import { useSaveSaleRecord } from './use-save-sale-record';
import { useUnmarkNoSales } from './use-unmark-no-sales';

const user = userEvent.setup();

const at = (iso: string) => epochMsSchema.parse(Date.parse(iso));

function recordId(n: number): SaleRecordId {
  return saleRecordIdSchema.parse(fixtureId(4, n));
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

async function runMutation<T>(mutate: () => Promise<T>): Promise<T> {
  let outcome: { readonly value: T } | undefined;
  await act(async () => {
    try {
      outcome = { value: await mutate() };
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
  if (outcome === undefined) {
    throw new Error('The mutation did not resolve.');
  }
  return outcome.value;
}

function dependenciesWithCatalog(): TestDependencies {
  const dependencies = createTestDependencies();
  dependencies.products.saveSync(makeCatalogProduct(1, [makeVersion(1)]));
  return dependencies;
}

function seedRecord(dependencies: TestDependencies, n: number, soldOn: string): void {
  dependencies.sales.saveSync(
    makeSaleRecord([makeSaleItem(n)], { id: recordId(n), soldOn: date(soldOn) }),
  );
}

const createCommand = (soldOn: LocalDate): SaveSaleRecordCommand => ({
  kind: 'create',
  input: { soldOn, channel: null, note: null, items: [makeItemInput(1)] },
});

function codes(errors: SaleErrors): readonly string[] {
  return errors.map((error) => error.code);
}

describe('useSaveSaleRecord and useDeleteSaleRecord', () => {
  let saveHook: ReturnType<typeof useSaveSaleRecord>;
  let deleteHook: ReturnType<typeof useDeleteSaleRecord>;

  function Probe() {
    saveHook = useSaveSaleRecord();
    deleteHook = useDeleteSaleRecord();
    return null;
  }

  it('resolves a created record', async () => {
    const dependencies = dependenciesWithCatalog();
    await mount(<Probe />, dependencies);

    const result = await runMutation(() => saveHook.mutateAsync(createCommand(date('2026-07-01'))));

    expect(result.ok && result.value.kind).toBe('saved');
  });

  it('returns domain errors by code without rejecting', async () => {
    await mount(<Probe />, dependenciesWithCatalog());

    const result = await runMutation(() => saveHook.mutateAsync(createCommand(date('2026-07-05'))));

    expect(!result.ok && codes(result.error)).toEqual(['future_date']);
  });

  it('returns record_not_found when deleting an unknown record', async () => {
    await mount(<Probe />, dependenciesWithCatalog());

    const result = await runMutation(() => deleteHook.mutateAsync(recordId(5)));

    expect(!result.ok && codes(result.error)).toEqual(['record_not_found']);
  });

  it('rejects unexpected errors and logs them', async () => {
    const dependencies = dependenciesWithCatalog();
    jest.spyOn(dependencies.sales, 'saveSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    await mount(<Probe />, dependencies);

    await expect(
      runMutation(() => saveHook.mutateAsync(createCommand(date('2026-07-01')))),
    ).rejects.toThrow('disk full');
    expect(
      dependencies.logger.entries.some((entry) => entry.event === 'save_sale_record_failed'),
    ).toBe(true);
  });
});

describe('useRecentSales', () => {
  function Recent() {
    const query = useRecentSales(2);
    const ids = query.data?.pages.flatMap((page) => page.records.map((r) => r.id)) ?? [];
    return (
      <>
        <Text>{`n:${String(ids.length)} more:${String(query.hasNextPage)}`}</Text>
        <Text onPress={() => void query.fetchNextPage()}>más</Text>
      </>
    );
  }

  it('pages with the cursor of the previous page', async () => {
    const dependencies = createTestDependencies();
    seedRecord(dependencies, 1, '2026-07-01');
    seedRecord(dependencies, 2, '2026-07-02');
    seedRecord(dependencies, 3, '2026-07-03');
    await mount(<Recent />, dependencies);

    expect(await screen.findByText('n:2 more:true')).toBeOnTheScreen();
    await user.press(screen.getByText('más'));

    expect(await screen.findByText('n:3 more:false')).toBeOnTheScreen();
  });

  it('shows a newly saved sale through invalidation', async () => {
    const dependencies = dependenciesWithCatalog();
    await mount(<Recent />, dependencies);
    expect(await screen.findByText('n:0 more:false')).toBeOnTheScreen();

    await runMutation(() => {
      dependencies.sales.saveSync(makeSaleRecord([makeSaleItem(1)], { id: recordId(1) }));
      return Promise.resolve();
    });

    expect(await screen.findByText('n:1 more:false')).toBeOnTheScreen();
  });

  it('does not reload sales when only no-sales weeks change', async () => {
    const dependencies = createTestDependencies();
    const listRecent = jest.spyOn(dependencies.sales, 'listRecent');
    await mount(<Recent />, dependencies);
    await screen.findByText('n:0 more:false');

    await runMutation(() => {
      dependencies.dataChanges.emit(new Set(['no_sales_weeks']));
      return Promise.resolve();
    });

    expect(listRecent).toHaveBeenCalledTimes(1);
  });
});

describe('useSaleRecord', () => {
  function Detail({ id }: { id: SaleRecordId }) {
    const { data, isPending, isError } = useSaleRecord(id);
    if (isPending) return <Text>cargando</Text>;
    if (isError) return <Text>falló</Text>;
    return <Text>{data === null ? 'no encontrado' : data.soldOn}</Text>;
  }

  it('loads the record', async () => {
    const dependencies = createTestDependencies();
    seedRecord(dependencies, 1, '2026-07-01');
    const release = holdCalls(dependencies.sales, 'findById');
    await mount(<Detail id={recordId(1)} />, dependencies);

    expect(screen.getByText('cargando')).toBeOnTheScreen();
    release();
    expect(await screen.findByText('2026-07-01')).toBeOnTheScreen();
  });

  it('reports null as not found', async () => {
    await mount(<Detail id={recordId(9)} />, createTestDependencies());

    expect(await screen.findByText('no encontrado')).toBeOnTheScreen();
  });

  it('reports a read error', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.sales, 'findById').mockRejectedValue(new Error('x'));
    await mount(<Detail id={recordId(1)} />, dependencies);

    expect(await screen.findByText('falló')).toBeOnTheScreen();
  });
});

describe('useNoSalesPrompt with useMarkNoSales and useUnmarkNoSales', () => {
  let markHook: ReturnType<typeof useMarkNoSales>;
  let unmarkHook: ReturnType<typeof useUnmarkNoSales>;

  function Prompt() {
    const { prompt, isPending } = useNoSalesPrompt();
    markHook = useMarkNoSales();
    unmarkHook = useUnmarkNoSales();
    return <Text>{isPending || prompt === null ? 'cargando' : prompt.kind}</Text>;
  }

  const MONDAY = '2026-07-06T15:00:00Z';
  const monday = (): NoSalesWeekCommand => ({ weekStart: date('2026-07-06') });

  it('offers a choice on Monday and moves to marked after marking, without manual invalidation', async () => {
    const dependencies = createTestDependencies();
    dependencies.clock.set(at(MONDAY));
    await mount(<Prompt />, dependencies);
    expect(await screen.findByText('choose')).toBeOnTheScreen();

    const result = await runMutation(() => markHook.mutateAsync(monday()));
    expect(result.ok).toBe(true);
    expect(await screen.findByText('single')).toBeOnTheScreen();

    await runMutation(() => markHook.mutateAsync({ weekStart: date('2026-06-29') }));
    expect(await screen.findByText('marked')).toBeOnTheScreen();

    await runMutation(() => unmarkHook.mutateAsync({ weekStart: date('2026-06-29') }));
    await waitFor(() => {
      expect(screen.getByText('single')).toBeOnTheScreen();
    });
  });

  it('recomputes for the new week when midnight passes', async () => {
    jest.useFakeTimers();
    try {
      const dependencies = createTestDependencies();
      dependencies.clock.set(at('2026-07-05T21:00:00Z'));
      dependencies.sales.saveSync(
        makeSaleRecord([makeSaleItem(1)], { id: recordId(1), soldOn: date('2026-07-05') }),
      );
      await mount(<Prompt />, dependencies);
      await waitFor(() => {
        expect(screen.getByText('has_sales')).toBeOnTheScreen();
      });

      await act(() => {
        advanceClockAndTimers(dependencies.clock, 12 * 60 * 60 * 1000);
      });

      await waitFor(() => {
        expect(screen.getByText('single')).toBeOnTheScreen();
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
