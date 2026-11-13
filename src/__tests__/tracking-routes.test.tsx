import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import type * as TestDependenciesModule from '@/core/testing/create-test-dependencies';
import * as SalesTestData from '@/core/testing/sales-test-data';

const mockApp: { dependencies?: TestDependenciesModule.TestDependencies } = {};

jest.mock('@/core/dependencies/create-app-dependencies', () => ({
  createAppDependencies: () => {
    mockApp.dependencies = jest
      .requireActual<typeof TestDependenciesModule>('@/core/testing/create-test-dependencies')
      .createTestDependencies();
    return {
      dependencies: mockApp.dependencies,
      migrateDatabase: () => Promise.resolve({ ok: true, value: undefined }),
      runAfterFirstRender: () => Promise.resolve(),
    };
  },
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@expo-google-fonts/lexend', () => ({
  useFonts: (): [boolean, null] => [true, null],
  Lexend_400Regular: 'regular',
  Lexend_500Medium: 'medium',
  Lexend_600SemiBold: 'semibold',
  Lexend_700Bold: 'bold',
}));

const user = userEvent.setup();

/** El reloj de prueba marca el 1 de julio de 2026; hay ventas en julio y en junio. */
async function renderWithSales(initialUrl?: string) {
  await renderRouter('src/app', initialUrl === undefined ? undefined : { initialUrl });
  return mockApp.dependencies;
}

function seed() {
  const dependencies = mockApp.dependencies;
  if (dependencies === undefined) {
    throw new Error('The dependencies are not composed yet.');
  }
  const product = SalesTestData.seedSellableProduct(dependencies, {
    name: 'Lámina Colibrí',
    price: 15000,
  });
  SalesTestData.seedSale(dependencies, { product, soldOn: '2026-07-01', n: 1 });
  SalesTestData.seedSale(dependencies, { product, soldOn: '2026-06-10', n: 2 });
}

describe('tracking routes', () => {
  it('opens the monthly summary from Inicio and goes back', async () => {
    await renderRouter('src/app');
    await screen.findByText('Aquí vas a ver cuánto vendes');
    seed();
    await testRouter.navigate('/');
    await user.press(await screen.findByRole('button', { name: 'Ver resumen de julio' }));

    expect(screen).toHavePathname('/tracking/monthly');
    expect(await screen.findByRole('header', { name: 'Resumen del mes' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(screen).toHavePathname('/');
  });

  it('opens the detail of a recent sale from Inicio', async () => {
    await renderRouter('src/app');
    await screen.findByText('Aquí vas a ver cuánto vendes');
    seed();
    await testRouter.navigate('/');

    await user.press(await screen.findByRole('button', { name: /^Lámina Colibrí, hoy,/ }));

    expect(await screen.findByRole('button', { name: 'Editar venta' })).toBeOnTheScreen();
  });

  it('shows the requested month and changes the parameter when navigating', async () => {
    await renderWithSales();
    seed();
    await testRouter.navigate('/tracking/monthly?month=2026-06');

    expect(await screen.findByRole('header', { name: 'Junio' })).toBeOnTheScreen();
    await user.press(await screen.findByRole('button', { name: 'Mes siguiente, julio' }));

    expect(await screen.findByRole('header', { name: 'Julio' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/tracking/monthly');
    expect(screen).toHaveSearchParams({ month: '2026-07' });
  });

  it.each(['2026-13', 'abc'])(
    'redirects the invalid month %s to the current one',
    async (month) => {
      await renderWithSales(`/tracking/monthly?month=${month}`);

      expect(await screen.findByRole('header', { name: 'Julio' })).toBeOnTheScreen();
      expect(screen).toHavePathname('/tracking/monthly');
      expect(screen).toHaveSearchParams({});
    },
  );

  it('redirects a repeated month to the current one', async () => {
    await renderWithSales('/tracking/monthly?month=2026-05&month=2026-06');

    expect(await screen.findByRole('header', { name: 'Julio' })).toBeOnTheScreen();
    expect(screen).toHaveSearchParams({});
  });

  it('shows the current month without a parameter and a future month as the current one', async () => {
    await renderWithSales('/tracking/monthly');
    expect(await screen.findByRole('header', { name: 'Julio' })).toBeOnTheScreen();

    await testRouter.navigate('/tracking/monthly?month=2027-01');
    expect(await screen.findByRole('header', { name: 'Julio' })).toBeOnTheScreen();
  });

  it('goes to the start when the summary was opened without history', async () => {
    await renderWithSales('/tracking/monthly');
    await user.press(await screen.findByRole('button', { name: 'Volver' }));

    expect(screen).toHavePathname('/');
  });
});
