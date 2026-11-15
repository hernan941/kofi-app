import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import type * as TestDependenciesModule from '@/core/testing/create-test-dependencies';
import * as SalesTestData from '@/core/testing/sales-test-data';

const mockApp: {
  dependencies?: TestDependenciesModule.TestDependencies;
  listSeenTips?: jest.SpyInstance;
} = {};

jest.mock('@/core/dependencies/create-app-dependencies', () => ({
  createAppDependencies: () => {
    mockApp.dependencies = jest
      .requireActual<typeof TestDependenciesModule>('@/core/testing/create-test-dependencies')
      .createTestDependencies();
    mockApp.listSeenTips = jest.spyOn(mockApp.dependencies.tipViews, 'listAll');
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

beforeEach(() => {
  mockApp.listSeenTips?.mockClear();
});

const TIP_CARD = /^Consejo · /;

function seedProduct() {
  if (mockApp.dependencies === undefined) {
    throw new Error('The dependencies are not composed yet.');
  }
  return SalesTestData.seedSellableProduct(mockApp.dependencies, {
    name: 'Lámina Colibrí',
    price: 15000,
  });
}

describe('tips routes', () => {
  it('goes to the list when the id of the tip is badly formed', async () => {
    await renderRouter('src/app', { initialUrl: '/tips/MAL_ID' });

    expect(await screen.findByRole('header', { name: 'Consejos' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/tips');
  });

  it('goes to the list when the id is well formed but not in the catalog', async () => {
    await renderRouter('src/app', { initialUrl: '/tips/no-existe' });

    expect(await screen.findByRole('header', { name: 'Consejos' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/tips');
  });

  it('goes back to the list from a tip opened without history', async () => {
    await renderRouter('src/app', { initialUrl: '/tips/fixture-streak' });
    await user.press(await screen.findByRole('button', { name: 'Volver' }));

    expect(await screen.findByRole('header', { name: 'Consejos' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/tips');
  });

  it('opens a tip from the list, reads it and comes back to see it marked as seen', async () => {
    await renderRouter('src/app', { initialUrl: '/tips' });
    await user.press(await screen.findByRole('button', { name: 'Título fixture-plain, Redes' }));

    expect(screen).toHavePathname('/tips/fixture-plain');
    expect(await screen.findByRole('header', { name: 'Título fixture-plain' })).toBeOnTheScreen();
    expect(screen.getByText('Cuerpo fixture-plain')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(
      await screen.findByRole('button', { name: 'Título fixture-plain, Redes, visto' }),
    ).toBeOnTheScreen();
    expect(screen).toHavePathname('/tips');
  });
});

describe('tip when the week is marked as without sales', () => {
  it('does not show a tip when the week is marked as without sales', async () => {
    await renderRouter('src/app', { initialUrl: '/calendar' });
    await user.press(
      await screen.findByRole('button', { name: 'Marcar que no vendí esta semana' }),
    );

    expect(await screen.findByText('Semana marcada como "no vendí"')).toBeOnTheScreen();
    expect(screen.queryByText(TIP_CARD)).not.toBeOnTheScreen();
    expect(screen.queryByText(/^Título fixture/)).not.toBeOnTheScreen();
  });
});

describe('tip after a sale', () => {
  it('shows a tip when a sale is created, closes it and leaves with Listo', async () => {
    seedProduct();
    await renderRouter('src/app', { initialUrl: '/sales/new' });
    await user.press(await screen.findByRole('button', { name: 'Guardar venta' }));

    expect(await screen.findByText(TIP_CARD)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Cerrar consejo' }));

    expect(screen.queryByText(TIP_CARD)).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Listo' }));
    await user.press(await screen.findByRole('button', { name: 'Ahora no' }));
    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen.queryByText(TIP_CARD)).not.toBeOnTheScreen();
  });

  it('does not show a tip when a sale is edited', async () => {
    const dependencies = mockApp.dependencies;
    if (dependencies === undefined) {
      throw new Error('The dependencies are not composed yet.');
    }
    const record = SalesTestData.seedSale(dependencies, {
      product: seedProduct(),
      soldOn: '2026-07-01',
      n: 9,
    });
    await renderRouter('src/app');
    await testRouter.push(`/sales/${record.id}`);
    await user.press(await screen.findByRole('button', { name: 'Editar venta' }));
    await user.press(await screen.findByRole('button', { name: /^Agregar uno a la cantidad de/ }));
    await user.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('button', { name: 'Editar venta' })).toBeOnTheScreen();
    expect(screen.queryByText(TIP_CARD)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cerrar consejo' })).not.toBeOnTheScreen();
  });

  it('does not read the seen tips on Inicio', async () => {
    await renderRouter('src/app');

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(mockApp.listSeenTips).toBeDefined();
    expect(mockApp.listSeenTips).not.toHaveBeenCalled();
  });

  it('does not show a tip on Inicio', async () => {
    await renderRouter('src/app');

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen.queryByText(TIP_CARD)).not.toBeOnTheScreen();
    expect(screen.queryByText(/^Título fixture/)).not.toBeOnTheScreen();
  });
});
