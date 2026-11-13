import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

import { createDataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { DataChangesBridge } from './data-changes-bridge';
import type { QueryDependency } from './root-keys-to-invalidate';

const DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['sales'], tables: new Set<TableName>(['sale_records']) },
  { rootKey: ['products'], tables: new Set<TableName>(['products']) },
];

async function mountBridge() {
  const dataChanges = createDataChanges(new RecordingLogger());
  const queryClient = new QueryClient();
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <DataChangesBridge dataChanges={dataChanges} dependencies={DEPENDENCIES} />
    </QueryClientProvider>,
  );
  return { dataChanges, invalidate, view };
}

describe('DataChangesBridge', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('invalidates the roots that depend on the changed tables', async () => {
    const { dataChanges, invalidate } = await mountBridge();

    dataChanges.emit(new Set<TableName>(['sale_records']));
    await jest.runAllTimersAsync();

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sales'] });
  });

  test('groups two emissions of the same tick into one invalidation per root', async () => {
    const { dataChanges, invalidate } = await mountBridge();

    dataChanges.emit(new Set<TableName>(['sale_records']));
    dataChanges.emit(new Set<TableName>(['sale_records', 'products']));
    await jest.runAllTimersAsync();

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sales'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['products'] });
  });

  test('does nothing for tables without dependents', async () => {
    const { dataChanges, invalidate } = await mountBridge();

    dataChanges.emit(new Set<TableName>(['tip_views']));
    await jest.runAllTimersAsync();

    expect(invalidate).not.toHaveBeenCalled();
  });

  test('cancels the subscription and the pending flush on unmount', async () => {
    const { dataChanges, invalidate, view } = await mountBridge();

    dataChanges.emit(new Set<TableName>(['sale_records']));
    await view.unmount();
    dataChanges.emit(new Set<TableName>(['products']));
    await jest.runAllTimersAsync();

    expect(invalidate).not.toHaveBeenCalled();
  });
});
