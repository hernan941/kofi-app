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
    await screen.findByRole('header', { name: 'Inicio' });
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
    await screen.findByRole('header', { name: 'Inicio' });
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

  it('opens the detail of a day from the Calendario and goes back', async () => {
    await renderRouter('src/app');
    await screen.findByRole('header', { name: 'Inicio' });
    seed();
    await testRouter.navigate('/calendar');

    await user.press(
      await screen.findByRole('button', { name: 'Hoy, 1 de julio, 15.000 pesos, 1 venta' }),
    );

    expect(screen).toHavePathname('/tracking/day/2026-07-01');
    expect(
      await screen.findByRole('header', { name: 'Hoy, miércoles 1 de julio' }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(screen).toHavePathname('/calendar');
  });

  it.each(['2026-02-30', 'abc'])('shows not-found for the invalid day %s', async (date) => {
    await renderWithSales(`/tracking/day/${date}`);

    expect(await screen.findByText('No encontramos esa pantalla')).toBeOnTheScreen();
  });

  it('shows a future day without the option to register', async () => {
    await renderWithSales('/tracking/day/2026-07-02');

    expect(
      await screen.findByText('Puedes registrar ventas de hoy o de días anteriores.'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Registrar una venta este día' }),
    ).not.toBeOnTheScreen();
  });

  it('registers a sale for the day of the detail', async () => {
    await renderWithSales('/tracking/day/2026-06-20');

    await user.press(await screen.findByRole('button', { name: 'Registrar una venta este día' }));

    expect(screen).toHavePathname('/sales/new');
    expect(screen).toHaveSearchParams({ date: '2026-06-20' });
  });

  it('starts the registration on the date of the link, and on today when it is future or invalid', async () => {
    await renderWithSales('/sales/new?date=2026-06-20');
    seed();
    expect(await screen.findByText(/20 de junio/)).toBeOnTheScreen();

    await testRouter.navigate('/sales/new?date=2026-07-09');
    expect(await screen.findByText(/Hoy, miércoles 1 de julio/)).toBeOnTheScreen();
  });
});
