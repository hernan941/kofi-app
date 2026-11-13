import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import type * as TestDependenciesModule from '@/core/testing/create-test-dependencies';

const user = userEvent.setup();

jest.mock('@/core/dependencies/create-app-dependencies', () => ({
  createAppDependencies: () => ({
    dependencies: jest
      .requireActual<typeof TestDependenciesModule>('@/core/testing/create-test-dependencies')
      .createTestDependencies(),
    migrateDatabase: () => Promise.resolve({ ok: true, value: undefined }),
    runAfterFirstRender: () => Promise.resolve(),
  }),
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

describe('products routes', () => {
  it('invites to create the first product, creates it and goes back to the list', async () => {
    await renderRouter('src/app', { initialUrl: '/products' });
    expect(await screen.findByText('Aquí vas a ver tus productos')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Agregar producto' }));
    expect(screen).toHavePathname('/products/new');

    await user.type(screen.getByLabelText('Nombre'), 'Lámina Colibrí');
    await user.type(screen.getByLabelText('¿A cuánto lo vendes?'), '15000');
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }),
    ).toBeOnTheScreen();
    expect(screen).toHavePathname('/products');
  });

  it('archives with a confirmation, finds the product in archived and uses it again', async () => {
    await renderRouter('src/app', { initialUrl: '/products' });
    await user.press(await screen.findByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));
    expect(await screen.findByRole('header', { name: 'Lámina Colibrí' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Archivar' }));
    await user.press(screen.getAllByRole('button', { name: 'Archivar' }).at(-1) as never);

    expect(await screen.findByText('No tienes productos en tu lista')).toBeOnTheScreen();
    expect(screen).toHavePathname('/products');

    await user.press(screen.getByRole('button', { name: 'Ver archivados' }));
    expect(screen).toHavePathname('/products/archived');
    await user.press(await screen.findByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));
    await user.press(await screen.findByRole('button', { name: 'Volver a usar' }));

    expect(await screen.findByRole('button', { name: 'Archivar' })).toBeOnTheScreen();
  });

  it('shows not-found for an invalid id in the detail and in the edit route', async () => {
    await renderRouter('src/app', { initialUrl: '/products/no-es-un-id' });
    expect(await screen.findByText('No encontramos esa pantalla')).toBeOnTheScreen();

    await testRouter.navigate('/products/no-es-un-id/edit');
    expect(await screen.findByText('No encontramos esa pantalla')).toBeOnTheScreen();
  });

  it('shows the product not-found state for a valid id that does not exist', async () => {
    await renderRouter('src/app', {
      initialUrl: '/products/11111111-1111-7111-8111-000000000999',
    });

    expect(await screen.findByText('No encontramos este producto')).toBeOnTheScreen();
  });
});
