import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

import type * as NativeIntentModule from '@/app/+native-intent';
import { clearPerfMarks, perfMark, readPerfMarks } from '@/shared/lib/perf-marks';
import type * as TestDependenciesModule from '@/core/testing/create-test-dependencies';

jest.mock('@/core/dependencies/create-app-dependencies', () => ({
  createAppDependencies: () => ({
    dependencies: jest
      .requireActual<typeof TestDependenciesModule>('@/core/testing/create-test-dependencies')
      .createTestDependencies(),
    migrateDatabase: () => Promise.resolve({ ok: true, value: undefined }),
    runAfterFirstRender: () => Promise.resolve(),
  }),
}));
jest.mock('@/features/e2e/adapters/expo-fixture-assets', () => ({
  materializeFixture: jest.fn(() => Promise.reject(new Error('no bundled fixture in tests'))),
}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

describe('hidden E2E routes with the E2E flag', () => {
  beforeAll(() => {
    process.env.EXPO_PUBLIC_E2E = '1';
  });

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_E2E;
  });

  it('opens the date diagnostics and every case matches', async () => {
    await renderRouter('src/app', { initialUrl: '/e2e/diagnostics' });

    expect(await screen.findByRole('header', { name: 'Diagnóstico de fechas' })).toBeOnTheScreen();
    expect(screen.getByText('Todos los casos coinciden')).toBeOnTheScreen();
    expect(screen).toHavePathname('/e2e/diagnostics');
  });

  it('opens the perf route and lists the marks recorded so far', async () => {
    perfMark('boot:migrate:start');

    await renderRouter('src/app', { initialUrl: '/e2e/perf' });

    expect(await screen.findByRole('header', { name: 'Marcas de rendimiento' })).toBeOnTheScreen();
    expect(String(screen.getByTestId('perf-marks').props.children)).toContain(
      'mark boot:migrate:start -',
    );
    expect(screen).toHavePathname('/e2e/perf');
  });

  it('marks the tab presses and the "Registrar venta" press that open the budgets', async () => {
    clearPerfMarks();
    await renderRouter('src/app', { initialUrl: '/' });

    await userEvent.setup().press(await screen.findByRole('button', { name: 'Calendario' }));
    await userEvent.setup().press(await screen.findByRole('button', { name: 'Productos' }));

    expect(
      readPerfMarks()
        .filter(({ name }) => name === 'tab:press')
        .map(({ detail }) => detail),
    ).toEqual(['calendar', 'products']);
  });

  it('opens the seed route and reports why the fixture could not load', async () => {
    await renderRouter('src/app', { initialUrl: '/e2e/seed?fixture=basic' });

    expect(
      await screen.findByText(
        'No se pudieron cargar los datos de prueba: no bundled fixture in tests',
      ),
    ).toBeOnTheScreen();
    expect(screen).toHavePathname('/e2e/seed');
  });

  it.each(['/e2e/seed', '/e2e/seed?fixture=huge'])(
    'redirects %s to the home tab when the fixture is missing or unknown',
    async (url) => {
      await renderRouter('src/app', { initialUrl: url });

      expect(await screen.findByRole('button', { name: 'Inicio' })).toBeSelected();
      expect(screen).toHavePathname('/');
    },
  );

  it('keeps the E2E deep links', () => {
    jest.isolateModules(() => {
      const intent = jest.requireActual<typeof NativeIntentModule>('@/app/+native-intent');
      expect(
        intent.redirectSystemPath({ path: 'cuantovendi://e2e/diagnostics', initial: true }),
      ).toBe('cuantovendi://e2e/diagnostics');
    });
  });
});
