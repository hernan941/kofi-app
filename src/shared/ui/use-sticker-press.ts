import { useState } from 'react';

/** Pressed state of a sticker and the handlers that drive it. */
export interface StickerPress {
  readonly isPressed: boolean;
  readonly onPressIn: () => void;
  readonly onPressOut: () => void;
}

/**
 * Tracks whether a sticker is held down, so it can "sink": 2 pt down and to the right with
 * the smaller shadow (design system 6.1). It is an instant change, not an animation, so it
 * does not depend on the reduced motion setting.
 */
export function useStickerPress(): StickerPress {
  const [isPressed, setIsPressed] = useState(false);
  return {
    isPressed,
    onPressIn: () => {
      setIsPressed(true);
    },
    onPressOut: () => {
      setIsPressed(false);
    },
  };
}

/** Shadow classes of a sticker at rest and while pressed. */
export function stickerShadowClasses(isPressed: boolean): string {
  return isPressed ? 'translate-x-0.5 translate-y-0.5 shadow-sticker-pressed' : 'shadow-sticker';
}
