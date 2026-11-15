import { act, userEvent, waitFor } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import type * as TestDependenciesModule from '@/core/testing/create-test-dependencies';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import type { NotificationPermission } from '@/features/notifications';
import {
  clp,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
} from '../features/sales/domain/testing/sale-fixtures';
import { fakeTap } from '@/features/notifications/testing/fake-notification-responses';

/** The root layout composes once per module registry, so each test swaps the doubles behind a proxy. */
const mockApp: { dependencies?: TestDependenciesModule.TestDependencies } = {};

jest.mock('@/core/dependencies/create-app-dependencies', () => ({
  createAppDependencies: () => ({
    dependencies: new Proxy(
      {},
      { get: (_target, key) => Reflect.get(mockApp.dependencies ?? {}, key) as unknown },
    ),
    migrateDatabase: () => Promise.resolve({ ok: true, value: undefined }),
    runAfterFirstRender: () => Promise.resolve(),
  }),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

const user = userEvent.setup();

beforeEach(() => {
  mockApp.dependencies = createTestDependencies();
});

const INTRO_TITLE = '¿Te recordamos anotar tus ventas?';

async function openSaleForm(options: { permission: NotificationPermission; isFirstSale: boolean }) {
  await renderRouter('src/app');
  await screen.findByRole('button', { name: 'Registrar venta' });
  const dependencies = mockApp.dependencies;
  dependencies?.notifications.setPermission(options.permission);
  dependencies?.products.saveSync(
    makeProduct(1, [makeVersion(1, { pricing: { mode: 'fixed', price: clp(15000) } })], {
      name: 'Lámina Colibrí',
    }),
  );
  if (!options.isFirstSale) {
    dependencies?.sales.saveSync(makeSaleRecord([makeSaleItem(9)]));
  }
  await testRouter.push('/sales/new');
  await user.press(await screen.findByRole('button', { name: 'Guardar venta' }));
}

async function pressDone() {
  await screen.findByRole('header', { name: /Registraste tu primera venta|Venta registrada/ });
  await user.press(await screen.findByRole('button', { name: 'Listo' }));
}

async function tapNotification(key: string, data: unknown) {
  await act(() => {
    mockApp.dependencies?.notificationResponses.emit(fakeTap(key, data));
  });
}

describe('notification taps', () => {
  it('opens the sale registration from the weekly reminder', async () => {
    await renderRouter('src/app');
    await screen.findByRole('button', { name: 'Registrar venta' });

    await tapNotification('cv.weekly.repeat@1', { v: 1, deepLink: '/sales/new' });

    expect(screen).toHavePathname('/sales/new');
  });

  it('opens the monthly summary of the month in the notice', async () => {
    await renderRouter('src/app');
    await screen.findByRole('button', { name: 'Registrar venta' });

    await tapNotification('cv.monthly.2026-12@1', {
      v: 1,
      kind: 'monthly_summary',
      deepLink: '/tracking/monthly',
      month: '2026-11',
    });

    expect(screen).toHavePathname('/tracking/monthly');
    expect(screen).toHaveSearchParams({ month: '2026-11' });
  });

  it('opens Inicio when the payload cannot be read', async () => {
    await renderRouter('src/app');
    await testRouter.push('/tracking/monthly');

    await tapNotification('cv.weekly.repeat@9', { nope: true });

    expect(screen).toHavePathname('/');
  });

  it('reconciles the notices once the app is ready', async () => {
    await renderRouter('src/app');
    await screen.findByRole('button', { name: 'Registrar venta' });

    expect(mockApp.dependencies?.notifications.operations.map(({ type }) => type)).toContain(
      'permission',
    );
  });
});

describe('reminder preferences route', () => {
  it('opens from the Ajustes tab and goes back to it', async () => {
    await renderRouter('src/app');
    await testRouter.navigate('/settings');

    await user.press(await screen.findByRole('button', { name: /^Recordatorios/ }));

    expect(screen).toHavePathname('/settings/notifications');
    expect(await screen.findByRole('switch', { name: 'Recordatorio semanal' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(screen).toHavePathname('/settings');
  });
});

describe('notification permission after the first sale', () => {
  it('shows the explanation only after "Listo", never together with the celebration', async () => {
    await openSaleForm({ permission: 'undetermined', isFirstSale: true });

    expect(
      await screen.findByRole('header', { name: /^¡Registraste tu primera venta!/ }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: INTRO_TITLE })).not.toBeOnTheScreen();

    await pressDone();

    expect(await screen.findByRole('header', { name: INTRO_TITLE })).toBeOnTheScreen();
    expect(screen).toHavePathname('/notifications/intro');
  });

  it('goes back to Inicio on "Ahora no" without asking for the permission', async () => {
    await openSaleForm({ permission: 'undetermined', isFirstSale: true });
    await pressDone();

    await screen.findByRole('header', { name: INTRO_TITLE });
    await user.press(await screen.findByRole('button', { name: 'Ahora no' }));

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
    expect(mockApp.dependencies?.notifications.requestCount).toBe(0);
  });

  it('reconciles the notices when the permission is granted from the explanation', async () => {
    await openSaleForm({ permission: 'undetermined', isFirstSale: true });
    const dependencies = mockApp.dependencies;
    if (dependencies === undefined) {
      throw new Error('The dependencies are not composed yet.');
    }
    await pressDone();
    jest.spyOn(dependencies.notifications, 'requestPermission').mockImplementation(() => {
      dependencies.notifications.setPermission('granted');
      return Promise.resolve('granted');
    });

    await user.press(await screen.findByRole('button', { name: 'Activar recordatorios' }));

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    await waitFor(() => {
      expect(dependencies.notifications.scheduledNow().length).toBeGreaterThan(0);
    });
  });

  it.each(['granted', 'denied'] as const)(
    'does not show the explanation when the permission is already %s',
    async (permission) => {
      await openSaleForm({ permission, isFirstSale: true });
      await pressDone();

      expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
      expect(screen.queryByRole('header', { name: INTRO_TITLE })).not.toBeOnTheScreen();
    },
  );

  it('does not show the explanation on a later sale', async () => {
    await openSaleForm({ permission: 'undetermined', isFirstSale: false });
    await pressDone();

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: INTRO_TITLE })).not.toBeOnTheScreen();
  });
});
