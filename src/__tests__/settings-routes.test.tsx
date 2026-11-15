import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import type * as TestDependenciesModule from '@/core/testing/create-test-dependencies';
import { THIRD_PARTY_NOTICES } from '@/features/settings';

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

function idOf(packageName: string): string {
  const notice = THIRD_PARTY_NOTICES.find((candidate) => candidate.packageName === packageName);
  if (notice === undefined) {
    throw new Error(`There is no notice for ${packageName}.`);
  }
  return notice.id;
}

describe('settings routes', () => {
  it('opens the reminders from Ajustes and goes back', async () => {
    await renderRouter('src/app');
    await testRouter.navigate('/settings');

    await user.press(await screen.findByRole('button', { name: /^Recordatorios/ }));

    expect(screen).toHavePathname('/settings/notifications');
    await user.press(await screen.findByRole('button', { name: 'Volver' }));
    expect(screen).toHavePathname('/settings');
  });

  it('opens the backup from Ajustes and goes back', async () => {
    await renderRouter('src/app');
    await testRouter.navigate('/settings');

    await user.press(await screen.findByRole('button', { name: /^Respaldo y planillas/ }));

    expect(screen).toHavePathname('/settings/backup');
    await user.press(await screen.findByRole('button', { name: 'Volver' }));
    expect(screen).toHavePathname('/settings');
  });

  it('opens the licenses from Ajustes and goes back', async () => {
    await renderRouter('src/app');
    await testRouter.navigate('/settings');

    await user.press(await screen.findByRole('button', { name: /^Licencias de terceros/ }));

    expect(screen).toHavePathname('/settings/licenses');
    expect(await screen.findByRole('header', { name: 'Licencias de terceros' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Volver' }));
    expect(screen).toHavePathname('/settings');
  });

  it('opens a license from the list and goes back to the list', async () => {
    await renderRouter('src/app', { initialUrl: '/settings/licenses' });

    await user.press(await screen.findByRole('button', { name: /^@babel\/runtime, versión/ }));

    expect(screen).toHavePathname(`/settings/licenses/${idOf('@babel/runtime')}`);
    expect(await screen.findByRole('header', { name: '@babel/runtime' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Volver' }));
    expect(screen).toHavePathname('/settings/licenses');
  });

  it('shows the Apache text of HeroUI Native at its own route', async () => {
    await renderRouter('src/app', { initialUrl: `/settings/licenses/${idOf('heroui-native')}` });

    expect(await screen.findByRole('header', { name: 'HeroUI Native' })).toBeOnTheScreen();
    expect(screen.getAllByText(/Apache License/).length).toBeGreaterThan(0);
  });

  it.each(['no-existe', '..%2F', 'MAYUSCULAS'])(
    'shows the not found screen for the license id %s',
    async (id) => {
      await renderRouter('src/app', { initialUrl: `/settings/licenses/${id}` });

      expect(await screen.findByText('No encontramos esa pantalla')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Ir al inicio' })).toBeOnTheScreen();
    },
  );
});
