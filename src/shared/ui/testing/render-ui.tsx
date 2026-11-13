import { render } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactElement, ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const ROOT_STYLE = { flex: 1 } as const;

const TEST_CONFIG = {
  devInfo: { stylingPrinciples: false },
  animation: 'disable-all',
} as const;

const TEST_WINDOW_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

/** Props of the provider wrapper used by component tests. */
interface UiTestProvidersProps {
  readonly children: ReactNode;
}

/**
 * Gesture root, safe area and HeroUI providers, in the order of `src/app/_layout.tsx`,
 * configured for tests: fixed window metrics, no developer
 * console messages and no animations, so portals (dialogs, toasts) render synchronously.
 */
export function UiTestProviders({ children }: UiTestProvidersProps) {
  return (
    <GestureHandlerRootView style={ROOT_STYLE}>
      <SafeAreaProvider initialMetrics={TEST_WINDOW_METRICS}>
        <HeroUINativeProvider config={TEST_CONFIG}>{children}</HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Renders a `shared/ui` component inside {@link UiTestProviders}. */
export function renderUi(element: ReactElement) {
  return render(element, { wrapper: UiTestProviders });
}
