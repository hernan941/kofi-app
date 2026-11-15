import { act } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import type { TableName } from '@/core/db/table-names';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import type { NotificationReconciler } from '../use-cases/notification-reconciler';

import { useNotificationTriggers } from './use-notification-triggers';

function Probe() {
  useNotificationTriggers();
  return null;
}

async function setup() {
  const dependencies = createTestDependencies();
  const request = jest.fn(() => Promise.resolve());
  const reconciler: NotificationReconciler = { request };
  const handlers: ((state: AppStateStatus) => void)[] = [];
  const removals: jest.Mock[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    handlers.push(handler);
    const remove = jest.fn();
    removals.push(remove);
    return { remove };
  });
  const view = await renderWithProviders(<Probe />, {
    dependencies: { ...dependencies, notificationReconciler: reconciler },
  });
  return { dependencies, request, handlers, removals, view };
}

describe('useNotificationTriggers', () => {
  it('asks for a reconciliation once when it mounts', async () => {
    const { request } = await setup();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('asks again when the app returns to the foreground, but not when it leaves', async () => {
    const { request, handlers } = await setup();

    await act(() => {
      handlers[0]?.('background');
      handlers[0]?.('inactive');
    });
    expect(request).toHaveBeenCalledTimes(1);
    await act(() => {
      handlers[0]?.('active');
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each(['sale_records', 'sale_items', 'no_sales_weeks', 'notification_preferences'] as const)(
    'asks when %s changes',
    async (table) => {
      const { dependencies, request } = await setup();

      await act(() => {
        dependencies.dataChanges.emit(new Set<TableName>([table]));
      });

      expect(request).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['products', 'tip_views', 'product_photos'] as const)(
    'does not ask when only %s changes',
    async (table) => {
      const { dependencies, request } = await setup();

      await act(() => {
        dependencies.dataChanges.emit(new Set<TableName>([table]));
      });

      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it('removes the AppState listener and the data subscription on unmount', async () => {
    const { dependencies, request, removals, view } = await setup();

    await view.unmount();
    dependencies.dataChanges.emit(new Set<TableName>(['sale_items']));

    expect(removals.length).toBeGreaterThan(0);
    for (const remove of removals) {
      expect(remove).toHaveBeenCalledTimes(1);
    }
    expect(request).toHaveBeenCalledTimes(1);
  });
});
