import { renderRouter, screen } from 'expo-router/testing-library';

import type * as NativeIntentModule from '@/app/+native-intent';
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

  it('keeps the E2E deep links', () => {
    jest.isolateModules(() => {
      const intent = jest.requireActual<typeof NativeIntentModule>('@/app/+native-intent');
      expect(
        intent.redirectSystemPath({ path: 'cuantovendi://e2e/diagnostics', initial: true }),
      ).toBe('cuantovendi://e2e/diagnostics');
    });
  });
});
