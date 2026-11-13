import { render, screen } from '@testing-library/react-native';
import path from 'node:path';
import { Text } from 'react-native';

import { configureAndMigrate } from '@/core/db/configure-and-migrate';
import { createTestDatabase } from '@/core/db/testing/test-database';
import { loadMigrationBundle } from '@/core/db/testing/load-migration-bundle';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { UiTestProviders } from '@/shared/ui/testing/render-ui';

import { DependenciesProvider } from './dependencies-context';
import { MigrationGate } from './migration-gate';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('@expo-google-fonts/lexend', () => ({
  useFonts: (): [boolean, null] => [true, null],
  Lexend_400Regular: 'regular',
  Lexend_500Medium: 'medium',
  Lexend_600SemiBold: 'semibold',
  Lexend_700Bold: 'bold',
}));

const MIGRATIONS_FOLDER = path.join(__dirname, '..', 'db', 'migrations');

describe('MigrationGate with a real database', () => {
  test('a forced foreign_key_check failure ends in the error screen and never mounts the app', async () => {
    const database = await createTestDatabase();
    database.raw.exec('PRAGMA foreign_keys = OFF');
    database.raw.exec(
      `INSERT INTO product_versions (id, product_id, pricing_mode, price, position, created_at, updated_at) VALUES ('v1', 'missing', 'fixed', 100, 0, 1, 1)`,
    );
    const bundle = loadMigrationBundle(MIGRATIONS_FOLDER);

    await render(
      <UiTestProviders>
        <DependenciesProvider dependencies={createTestDependencies()}>
          <MigrationGate
            migrateDatabase={() => configureAndMigrate(database.raw, database.db, bundle)}
            runAfterFirstRender={() => Promise.resolve()}
          >
            <Text>Contenido de la app</Text>
          </MigrationGate>
        </DependenciesProvider>
      </UiTestProviders>,
    );

    expect(await screen.findByText('No pudimos abrir tus datos')).toBeOnTheScreen();
    expect(screen.queryByText('Contenido de la app')).not.toBeOnTheScreen();
    database.close();
  });
});
