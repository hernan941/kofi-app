import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import type * as TestDependenciesModule from '@/core/testing/create-test-dependencies';
import { saleRecordIdSchema } from '@/shared/domain';

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

async function savedRecordId() {
  const page = await mockApp.dependencies?.sales.listRecent(1);
  return saleRecordIdSchema.parse(page?.records[0]?.id);
}

describe('sales routes', () => {
  it('registers the first sale from Inicio: invites to create a product, comes back and celebrates', async () => {
    await renderRouter('src/app');
    await user.press(await screen.findByRole('button', { name: 'Registrar venta' }));
    expect(screen).toHavePathname('/sales/new');
    expect(await screen.findByText('Primero, agrega lo que vendes')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Agregar producto' }));
    expect(screen).toHavePathname('/products/new');
    await user.type(screen.getByLabelText('Nombre'), 'Lámina Colibrí');
    await user.type(screen.getByLabelText('¿A cuánto lo vendes?'), '15000');
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByLabelText('Total: 15.000 pesos')).toBeOnTheScreen();
    expect(screen).toHavePathname('/sales/new');
    await user.press(screen.getByRole('button', { name: 'Guardar venta' }));
    expect(
      await screen.findByRole('header', { name: '¡Registraste tu primera venta!' }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Listo' }));

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
  });

  it('opens the sale detail, edits it and sees the change', async () => {
    await renderRouter('src/app');
    const id = await savedRecordId();

    await testRouter.push(`/sales/${id}`);
    expect(await screen.findByRole('button', { name: 'Editar venta' })).toBeOnTheScreen();
    expect(screen.getAllByLabelText('15.000 pesos').length).toBeGreaterThan(0);

    await user.press(screen.getByRole('button', { name: 'Editar venta' }));
    expect(screen).toHavePathname(`/sales/${id}/edit`);
    await user.press(await screen.findByRole('button', { name: 'Agregar uno' }));
    await user.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('button', { name: 'Editar venta' })).toBeOnTheScreen();
    expect(screen).toHavePathname(`/sales/${id}`);
    expect(
      await screen.findByLabelText('Lámina Colibrí, 2 de 15.000 pesos, 30.000 pesos'),
    ).toBeOnTheScreen();
  });

  it('deletes the sale from the detail after confirming and goes back', async () => {
    await renderRouter('src/app');
    const id = await savedRecordId();
    await testRouter.push(`/sales/${id}`);

    await user.press(await screen.findByRole('button', { name: 'Borrar venta' }));
    await user.press(screen.getAllByRole('button', { name: 'Borrar venta' }).at(-1) as never);

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
    expect(await mockApp.dependencies?.sales.findById(id)).toBeNull();
  });

  it('shows not-found for an invalid id in the detail and in the edit route', async () => {
    await renderRouter('src/app', { initialUrl: '/sales/no-es-un-id' });
    expect(await screen.findByText('No encontramos esa pantalla')).toBeOnTheScreen();

    await testRouter.navigate('/sales/no-es-un-id/edit');
    expect(await screen.findByText('No encontramos esa pantalla')).toBeOnTheScreen();
  });

  it('shows the sale not-found state for a valid id that does not exist', async () => {
    await renderRouter('src/app', {
      initialUrl: '/sales/44444444-4444-7444-8444-000000000999',
    });

    expect(await screen.findByText('No encontramos esta venta')).toBeOnTheScreen();
  });

  it('goes to the start when the registration was opened without history', async () => {
    await renderRouter('src/app', { initialUrl: '/sales/new' });
    await user.press(await screen.findByRole('button', { name: 'Guardar venta' }));
    expect(await screen.findByRole('header', { name: '¡Venta registrada!' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Listo' }));

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
  });

  it('goes to the start when cancelling the registration opened without history', async () => {
    await renderRouter('src/app', { initialUrl: '/sales/new' });

    await user.press(await screen.findByRole('button', { name: 'Volver' }));

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
  });

  it('goes to the start when going back from a detail opened without history', async () => {
    await renderRouter('src/app', {
      initialUrl: '/sales/44444444-4444-7444-8444-000000000999',
    });

    await user.press(await screen.findByRole('button', { name: 'Volver' }));

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
  });

  it('goes to the start when cancelling an edit opened without history', async () => {
    await renderRouter('src/app', {
      initialUrl: '/sales/44444444-4444-7444-8444-000000000999/edit',
    });

    await user.press(await screen.findByRole('button', { name: 'Volver' }));

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
  });
});
