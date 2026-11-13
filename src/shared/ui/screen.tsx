import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Props of {@link Screen}. */
export interface ScreenProps {
  readonly children: ReactNode;
}

/**
 * Base of a tab or stack screen: `background` fill and the top safe area, since the
 * navigation headers are hidden. The bottom edge is left to the tab bar.
 */
export function Screen({ children }: ScreenProps) {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {children}
    </SafeAreaView>
  );
}
