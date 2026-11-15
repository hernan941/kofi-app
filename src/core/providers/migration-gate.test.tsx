import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Text } from 'react-native';

import type { BootFailure, MigrationResult } from '@/core/db/configure-and-migrate';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { err, ok } from '@/shared/domain/result';
import { UiTestProviders } from '@/shared/ui/testing/render-ui';

import { clearPerfMarks, readPerfMarks } from '@/shared/lib/perf-marks';
import { DependenciesProvider } from './dependencies-context';
import { MigrationGate, type MigrationGateProps } from './migration-gate';

type FontsResult = [boolean, Error | null];

const mockUseFonts = jest.fn<FontsResult, []>();

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock('@expo-google-fonts/lexend/useFonts', () => ({
  useFonts: (): FontsResult => mockUseFonts(),
}));

const FOREIGN_KEYS: BootFailure = { kind: 'foreign_key_violation', violations: 1 };

function gateFor(
  migrateDatabase: () => Promise<MigrationResult>,
  dependencies = createTestDependencies(),
  runAfterFirstRender: () => Promise<void> = () => Promise.resolve(),
  exportEmergency?: MigrationGateProps['exportEmergency'],
) {
  return (
    <UiTestProviders>
      <DependenciesProvider dependencies={dependencies}>
        <MigrationGate
          migrateDatabase={migrateDatabase}
          runAfterFirstRender={runAfterFirstRender}
          exportEmergency={exportEmergency}
        >
          <Text>Contenido de la app</Text>
        </MigrationGate>
      </DependenciesProvider>
    </UiTestProviders>
  );
}

describe('MigrationGate', () => {
  beforeEach(() => {
    jest.mocked(SplashScreen.hideAsync).mockResolvedValue(undefined);
    mockUseFonts.mockReturnValue([true, null]);
  });

  test('keeps the app hidden and the splash visible while the database migrates', async () => {
    const migration = new Promise<MigrationResult>(() => undefined);

    await render(gateFor(() => migration));

    expect(screen.queryByText('Contenido de la app')).not.toBeOnTheScreen();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  test('keeps the splash while the fonts load', async () => {
    mockUseFonts.mockReturnValue([false, null]);

    await render(gateFor(() => Promise.resolve(ok(undefined))));

    expect(screen.queryByText('Contenido de la app')).not.toBeOnTheScreen();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  test('shows the children and hides the splash once when everything is ready', async () => {
    const dependencies = createTestDependencies();
    const migrate = () => Promise.resolve(ok(undefined));
    const { rerender } = await render(gateFor(migrate, dependencies));

    expect(await screen.findByText('Contenido de la app')).toBeOnTheScreen();
    await rerender(gateFor(migrate, dependencies));

    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  test('continues with the system font and logs it when the fonts fail', async () => {
    const dependencies = createTestDependencies();
    mockUseFonts.mockReturnValue([false, new Error('font')]);

    await render(gateFor(() => Promise.resolve(ok(undefined)), dependencies));

    expect(await screen.findByText('Contenido de la app')).toBeOnTheScreen();
    expect(dependencies.logger.entriesAt('warn').map((entry) => entry.event)).toEqual([
      'fonts_failed',
    ]);
  });

  test('shows the error screen without the app when the foreign key check fails', async () => {
    const dependencies = createTestDependencies();

    await render(gateFor(() => Promise.resolve(err(FOREIGN_KEYS)), dependencies));

    expect(await screen.findByText('No pudimos abrir tus datos')).toBeOnTheScreen();
    expect(screen.queryByText('Contenido de la app')).not.toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    expect(dependencies.logger.entriesAt('error').map((entry) => entry.event)).toEqual([
      'boot_failed',
    ]);
  });

  test('asks to update the app when the database is newer than the code', async () => {
    const newer: BootFailure = { kind: 'newer_database', appliedMigrations: 4, knownMigrations: 1 };

    await render(gateFor(() => Promise.resolve(err(newer))));

    expect(await screen.findByText('Actualiza la app')).toBeOnTheScreen();
  });

  test('shows the error screen when the migration task throws', async () => {
    await render(gateFor(() => Promise.reject(new Error('boom'))));

    expect(await screen.findByText('No pudimos abrir tus datos')).toBeOnTheScreen();
  });

  test('shows the error screen and hides the splash when the migration throws synchronously', async () => {
    const migrateDatabase = (): Promise<MigrationResult> => {
      throw new Error('open failed');
    };

    await render(gateFor(migrateDatabase));

    expect(await screen.findByText('No pudimos abrir tus datos')).toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  test('ignores a late migration result once it is unmounted', async () => {
    const dependencies = createTestDependencies();
    let finish: (result: MigrationResult) => void = () => undefined;
    const migration = new Promise<MigrationResult>((resolve) => {
      finish = resolve;
    });
    const view = await render(gateFor(() => migration, dependencies));
    await view.unmount();

    await act(async () => {
      finish(err(FOREIGN_KEYS));
      await migration;
    });

    expect(dependencies.logger.entriesAt('error')).toEqual([]);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  test('does not migrate again when it mounts again', async () => {
    const migrate = jest.fn(() => Promise.resolve(ok(undefined)));
    const view = await render(gateFor(migrate));
    await screen.findByText('Contenido de la app');
    await view.unmount();

    await render(gateFor(migrate));
    await screen.findByText('Contenido de la app');

    expect(migrate).toHaveBeenCalledTimes(1);
  });

  describe('after the first render', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('schedules the task after the children render, without running it inline', async () => {
      const task = jest.fn(() => Promise.resolve());
      const migrate = () => Promise.resolve(ok(undefined));

      await render(gateFor(migrate, createTestDependencies(), task));
      expect(await screen.findByText('Contenido de la app')).toBeOnTheScreen();
      expect(task).not.toHaveBeenCalled();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(task).toHaveBeenCalledTimes(1);
    });

    test('runs only once even if the gate mounts again', async () => {
      const task = jest.fn(() => Promise.resolve());
      const migrate = () => Promise.resolve(ok(undefined));
      const view = await render(gateFor(migrate, createTestDependencies(), task));
      await screen.findByText('Contenido de la app');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });
      await view.unmount();

      await render(gateFor(migrate, createTestDependencies(), task));
      await screen.findByText('Contenido de la app');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(task).toHaveBeenCalledTimes(1);
    });

    test('keeps the app running and logs when the task rejects', async () => {
      const dependencies = createTestDependencies();
      const task = () => Promise.reject(new Error('disk'));

      await render(gateFor(() => Promise.resolve(ok(undefined)), dependencies, task));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Contenido de la app')).toBeOnTheScreen();
      expect(dependencies.logger.entriesAt('error').map((entry) => entry.event)).toEqual([
        'after_first_render_failed',
      ]);
    });

    test('keeps the app running and logs when the task throws synchronously', async () => {
      const dependencies = createTestDependencies();
      const task = (): Promise<void> => {
        throw new Error('sync');
      };

      await render(gateFor(() => Promise.resolve(ok(undefined)), dependencies, task));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Contenido de la app')).toBeOnTheScreen();
      expect(dependencies.logger.entriesAt('error')).toHaveLength(1);
    });

    test('does not run when the boot fails', async () => {
      const task = jest.fn(() => Promise.resolve());

      await render(
        gateFor(() => Promise.resolve(err(FOREIGN_KEYS)), createTestDependencies(), task),
      );
      await screen.findByText('No pudimos abrir tus datos');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0);
      });

      expect(task).not.toHaveBeenCalled();
    });
  });

  describe('emergency export', () => {
    const NEWER: BootFailure = { kind: 'newer_database', appliedMigrations: 4, knownMigrations: 1 };
    const MIGRATION: BootFailure = { kind: 'migration_failed' };
    const BUTTON = 'Guardar una copia de mis datos';

    function gateWithEmergency(
      failure: BootFailure,
      exportEmergency: NonNullable<MigrationGateProps['exportEmergency']>,
      dependencies = createTestDependencies(),
    ) {
      return gateFor(
        () => Promise.resolve(err(failure)),
        dependencies,
        () => Promise.resolve(),
        exportEmergency,
      );
    }

    test.each([FOREIGN_KEYS, NEWER, MIGRATION])(
      'offers the copy for %j and exports with the failure kind',
      async (failure) => {
        const exportEmergency = jest.fn(() => Promise.resolve(ok(undefined)));
        const user = userEvent.setup();
        await render(gateWithEmergency(failure, exportEmergency));

        await user.press(await screen.findByRole('button', { name: BUTTON }));

        expect(exportEmergency).toHaveBeenCalledWith(failure.kind);
        expect(await screen.findByText(/Copia lista/)).toBeOnTheScreen();
      },
    );

    test('does not offer the copy when no export is connected or the app is ready', async () => {
      await render(gateFor(() => Promise.resolve(err(FOREIGN_KEYS))));
      await screen.findByText('No pudimos abrir tus datos');
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    });

    test('ignores a second press while the copy is being prepared', async () => {
      let finish: (result: ReturnType<typeof ok<undefined>>) => void = () => undefined;
      const exportEmergency = jest.fn(
        () =>
          new Promise<ReturnType<typeof ok<undefined>>>((resolve) => {
            finish = resolve;
          }),
      );
      const user = userEvent.setup();
      await render(gateWithEmergency(MIGRATION, exportEmergency));

      await user.press(await screen.findByRole('button', { name: BUTTON }));
      await user.press(screen.getByRole('button', { name: BUTTON }));

      expect(exportEmergency).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Preparando la copia…')).toBeOnTheScreen();
      await act(async () => {
        finish(ok(undefined));
        await Promise.resolve();
      });
      expect(await screen.findByText(/Copia lista/)).toBeOnTheScreen();
    });

    test('shows the message of the problem and lets the person try again', async () => {
      const exportEmergency = jest
        .fn()
        .mockResolvedValueOnce(err({ code: 'not_enough_space', requiredBytes: 350_000_000 }))
        .mockResolvedValueOnce(ok(undefined));
      const user = userEvent.setup();
      await render(gateWithEmergency(MIGRATION, exportEmergency));

      await user.press(await screen.findByRole('button', { name: BUTTON }));
      expect(
        await screen.findByText(
          'No hay espacio suficiente para la copia. Libera al menos 350 MB y vuelve a intentarlo.',
        ),
      ).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: BUTTON }));

      expect(await screen.findByText(/Copia lista/)).toBeOnTheScreen();
      expect(exportEmergency).toHaveBeenCalledTimes(2);
    });

    test('shows a friendly message and logs when the export throws', async () => {
      const dependencies = createTestDependencies();
      const exportEmergency = jest.fn(() => Promise.reject(new Error('disk exploded')));
      const user = userEvent.setup();
      await render(gateWithEmergency(MIGRATION, exportEmergency, dependencies));

      await user.press(await screen.findByRole('button', { name: BUTTON }));

      expect(
        await screen.findByText('No pudimos crear la copia. Vuelve a intentarlo en un momento.'),
      ).toBeOnTheScreen();
      expect(dependencies.logger.entriesAt('error').map((entry) => entry.event)).toContain(
        'emergency_export_failed',
      );
    });
  });
});

describe('MigrationGate performance marks (P1.d)', () => {
  beforeEach(() => {
    jest.mocked(SplashScreen.hideAsync).mockResolvedValue(undefined);
    mockUseFonts.mockReturnValue([true, null]);
    process.env.EXPO_PUBLIC_E2E = '1';
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E;
    clearPerfMarks();
  });

  test('marks the start and the end of the migration, in that order', async () => {
    await render(gateFor(() => Promise.resolve({ ok: true, value: undefined })));
    await screen.findByText('Contenido de la app');

    expect(readPerfMarks().map(({ name }) => name)).toEqual([
      'boot:migrate:start',
      'boot:migrate:end',
    ]);
  });

  test('marks the end also when the migration fails', async () => {
    await render(gateFor(() => Promise.reject(new Error('boom'))));
    await waitFor(() => {
      expect(readPerfMarks().map(({ name }) => name)).toEqual([
        'boot:migrate:start',
        'boot:migrate:end',
      ]);
    });
  });
});
