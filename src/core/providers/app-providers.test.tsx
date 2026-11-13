import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { MigrationResult } from '@/core/db/configure-and-migrate';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { err, ok } from '@/shared/domain/result';

import { AppProviders } from './app-providers';
import { useDependencies } from './dependencies-context';

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

function Probe() {
  const dependencies = useDependencies();
  const queryClient = useQueryClient();
  return (
    <Text>
      {`${typeof dependencies.logger.info} ${String(queryClient.getDefaultOptions().queries?.retry)}`}
    </Text>
  );
}

function compositionWith(result: MigrationResult) {
  return {
    dependencies: createTestDependencies(),
    migrateDatabase: () => Promise.resolve(result),
    runAfterFirstRender: () => Promise.resolve(),
  };
}

describe('AppProviders', () => {
  test('gives the children the dependencies and a query client for local data', async () => {
    await render(
      <AppProviders composition={compositionWith(ok(undefined))}>
        <Probe />
      </AppProviders>,
    );

    expect(await screen.findByText('function false')).toBeOnTheScreen();
  });

  test('does not mount the children when the foreign key check finds a violation', async () => {
    await render(
      <AppProviders
        composition={compositionWith(err({ kind: 'foreign_key_violation', violations: 1 }))}
      >
        <Probe />
      </AppProviders>,
    );

    expect(await screen.findByText('No pudimos abrir tus datos')).toBeOnTheScreen();
    expect(screen.queryByText('function false')).not.toBeOnTheScreen();
  });
});
