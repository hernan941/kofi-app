import type { ReactNode } from 'react';
import Animated, {
  FadeIn as FadeInAnimation,
  FadeOut as FadeOutAnimation,
  useReducedMotion,
} from 'react-native-reanimated';

/** Duration of the entrance, in milliseconds. */
const ENTRANCE_DURATION_MS = 200;

/** Duration of the exit, in milliseconds. */
const EXIT_DURATION_MS = 150;

/** Props of {@link FadeIn}. */
export interface FadeInProps {
  readonly children: ReactNode;
  /** Entrance duration in milliseconds; 200 by default. */
  readonly duration?: number;
  readonly testID?: string;
}

/**
 * Wraps its children with a soft entrance (opacity from 0 to 1) and a shorter exit when it
 * leaves the tree. It does not reserve space or move what is already on screen. When the
 * system asks to reduce motion it animates nothing: the content appears and goes at once.
 * The children stay reachable by the screen reader from the start.
 */
export function FadeIn({ children, duration = ENTRANCE_DURATION_MS, testID }: FadeInProps) {
  const isReducedMotion = useReducedMotion();
  return (
    <Animated.View
      testID={testID}
      entering={isReducedMotion ? undefined : FadeInAnimation.duration(duration)}
      exiting={isReducedMotion ? undefined : FadeOutAnimation.duration(EXIT_DURATION_MS)}
    >
      {children}
    </Animated.View>
  );
}
