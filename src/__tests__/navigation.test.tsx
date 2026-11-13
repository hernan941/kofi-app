import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { StyleSheet, type ViewStyle } from 'react-native';

import { redirectSystemPath } from '@/app/+native-intent';
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

const HIDDEN = { includeHiddenElements: true } as const;

/**
 * The tab bar draws the active and the inactive icon of each tab on top of each other and
 * hides one with `opacity: 0`; the icon the person sees is the one with no transparent ancestor.
 */
function isSeen(testId: string): boolean {
  for (let node = screen.getByTestId(testId, HIDDEN).parent; node; node = node.parent) {
    const style = StyleSheet.flatten(node.props.style as ViewStyle | undefined);
    if (style?.opacity === 0) {
      return false;
    }
  }
  return true;
}

const TABS = ['Inicio', 'Calendario', 'Productos', 'Consejos', 'Ajustes'] as const;

describe('navigation', () => {
  it('shows the five tabs with Inicio selected and its filled icon visible', async () => {
    await renderRouter('src/app');

    for (const name of TABS) {
      expect(await screen.findByRole('button', { name })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: 'Inicio' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Calendario' })).not.toBeSelected();
    expect(isSeen('phosphor-react-native-house-fill')).toBe(true);
    expect(isSeen('phosphor-react-native-house-bold')).toBe(false);
    expect(screen.getByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();
  });

  it('opens the sale registration from the "Registrar venta" button of Inicio', async () => {
    await renderRouter('src/app');

    await user.press(await screen.findByRole('button', { name: 'Registrar venta' }));

    expect(screen).toHavePathname('/sales/new');
    expect(await screen.findByRole('header', { name: 'Registrar venta' })).toBeOnTheScreen();
  });

  it('moves between tabs and marks only the active one', async () => {
    await renderRouter('src/app');

    await user.press(await screen.findByRole('button', { name: 'Calendario' }));

    expect(screen).toHavePathname('/calendar');
    expect(screen.getByRole('button', { name: 'Calendario' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Inicio' })).not.toBeSelected();
    expect(isSeen('phosphor-react-native-calendar-blank-fill')).toBe(true);
    expect(isSeen('phosphor-react-native-house-bold')).toBe(true);
    expect(isSeen('phosphor-react-native-house-fill')).toBe(false);
    expect(screen.getByRole('header', { name: 'Calendario' })).toBeOnTheScreen();
  });

  it.each([
    ['/products', 'Productos'],
    ['/tips', 'Consejos'],
    ['/settings', 'Ajustes'],
  ] as const)('opens %s', async (path, title) => {
    await renderRouter('src/app');
    await screen.findByRole('button', { name: 'Inicio' });

    await testRouter.navigate(path);

    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
  });

  it('shows the not-found screen for an unknown URL and goes home from it', async () => {
    await renderRouter('src/app', { initialUrl: '/does-not-exist' });

    expect(await screen.findByText('No encontramos esa pantalla')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Ir al inicio' }));

    expect(screen).toHavePathname('/');
    expect(await screen.findByRole('button', { name: 'Inicio' })).toBeSelected();
  });

  it('does not reach the hidden E2E diagnostics route without the E2E flag', async () => {
    await renderRouter('src/app', { initialUrl: '/e2e/diagnostics' });

    expect(await screen.findByRole('button', { name: 'Inicio' })).toBeSelected();
    expect(screen).toHavePathname('/');
    expect(screen.queryByText('Diagnóstico de fechas')).not.toBeOnTheScreen();
  });

  it('sends E2E deep links to the home tab without the E2E flag', () => {
    expect(
      redirectSystemPath({ path: 'cuantovendi://e2e/seed?fixture=basic', initial: true }),
    ).toBe('/');
    expect(redirectSystemPath({ path: '/products', initial: false })).toBe('/products');
  });
});
