import type { ReactNode } from 'react';
import { View } from 'react-native';

import { stickerShadowClasses } from './use-sticker-press';

/** Props of {@link Sticker}. */
export interface StickerProps {
  readonly children: ReactNode;
  readonly isPressed?: boolean;
  readonly className?: string;
}

/**
 * Sticker frame of the design system (1, 4.4): 2 pt border, `rounded-3xl` and the solid
 * shadow. The shadow lives on an outer view without `overflow: hidden`, so the clipping
 * of HeroUI `Surface` and `Card` cannot cut it; the content is clipped by the inner view.
 * While pressed it sinks 2 pt with the smaller shadow. `className` styles the inner view
 * (fill and padding).
 */
export function Sticker({ children, isPressed = false, className = '' }: StickerProps) {
  return (
    <View className={`rounded-3xl ${stickerShadowClasses(isPressed)}`}>
      <View className={`overflow-hidden rounded-3xl border-2 border-border ${className}`}>
        {children}
      </View>
    </View>
  );
}
