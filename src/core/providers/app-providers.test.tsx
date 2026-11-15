import { useQueryClient } from '@tanstack/react-query';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { MigrationResult } from '@/core/db/configure-and-migrate';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { err, ok } from '@/shared/domain/result';
import { useToday } from '@/shared/lib/time/use-today';

import { AppProviders } from './app-providers';
import { useDependencies } from './dependencies-context';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(() => Promise.resolve()),
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

function TodayProbe() {
  return <Text>{`today ${useToday()}`}</Text>;
}

function compositionWith(result: MigrationResult) {
  return {
    dependencies: createTestDependencies(),
    migrateDatabase: () => Promise.resolve(result),
    runAfterFirstRender: () => Promise.resolve(),
    exportEmergency: jest.fn(() => Promise.resolve(ok(undefined))),
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

  test('shares the current date with the children', async () => {
    await render(
      <AppProviders composition={compositionWith(ok(undefined))}>
        <TodayProbe />
      </AppProviders>,
    );

    expect(await screen.findByText('today 2026-07-01')).toBeOnTheScreen();
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

  test('connects the emergency export of the composition to the error screen', async () => {
    const composition = compositionWith(err({ kind: 'foreign_key_violation', violations: 1 }));
    const user = userEvent.setup();
    await render(
      <AppProviders composition={composition}>
        <Probe />
      </AppProviders>,
    );

    await user.press(await screen.findByRole('button', { name: 'Guardar una copia de mis datos' }));

    expect(composition.exportEmergency).toHaveBeenCalledWith('foreign_key_violation');
    expect(await screen.findByText(/Copia lista/)).toBeOnTheScreen();
  });
});
