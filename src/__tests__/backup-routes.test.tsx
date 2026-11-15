import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

import type * as TestDependenciesModule from '@/core/testing/create-test-dependencies';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { buildBackupArchive } from '@/features/backup/testing/backup-archive-builder';
import {
  EMPTY_SNAPSHOT,
  itemRow,
  productRow,
  recordRow,
  versionRow,
} from '@/features/backup/testing/snapshot-fixtures';

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
const PICKED = 'file:///fake/cache/DocumentPicker/respaldo.zip';

beforeEach(() => {
  mockApp.dependencies = createTestDependencies();
});

describe('backup route', () => {
  it('opens from the Ajustes tab and goes back to it', async () => {
    await renderRouter('src/app');
    await testRouter.navigate('/settings');

    await user.press(await screen.findByRole('button', { name: /^Respaldo y planillas/ }));

    expect(screen).toHavePathname('/settings/backup');
    expect(await screen.findByRole('button', { name: 'Crear respaldo' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(screen).toHavePathname('/settings');
  });

  it('leaves the stack at Inicio after restoring, so going back never returns to the success', async () => {
    const dependencies = mockApp.dependencies;
    if (dependencies === undefined) throw new Error('The dependencies are not composed yet.');
    dependencies.archiveIo.put(
      PICKED,
      await buildBackupArchive({
        snapshot: {
          ...EMPTY_SNAPSHOT,
          products: [productRow(1)],
          productVersions: [versionRow(1, 1)],
          saleRecords: [recordRow(1)],
          saleItems: [itemRow(1, 1, 1, 1)],
        },
      }),
    );
    dependencies.documentPicker.picked = { uri: PICKED, name: 'respaldo.zip', size: 10 };
    await renderRouter('src/app');
    await testRouter.navigate('/settings');
    await user.press(await screen.findByRole('button', { name: /^Respaldo y planillas/ }));
    await user.press(await screen.findByRole('button', { name: 'Elegir un respaldo' }));
    await user.press(await screen.findByRole('button', { name: 'Reemplazar mis datos' }));
    await user.press(await screen.findByRole('button', { name: 'Sí, reemplazar' }));

    await user.press(await screen.findByRole('button', { name: 'Ir al inicio' }));

    expect(await screen.findByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/');
  });
});
