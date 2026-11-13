import { Surface } from 'heroui-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { stickerShadowClasses, useStickerPress } from './use-sticker-press';

/** Props shared by both kinds of card. */
interface CardBaseProps {
  readonly children: ReactNode;
  readonly title?: string;
}

/** A card that is only content. */
interface StaticCardProps extends CardBaseProps {
  readonly onPress?: undefined;
  readonly accessibilityLabel?: undefined;
}

/** A card that is a single button; its label sums up the content. */
interface PressableCardProps extends CardBaseProps {
  readonly onPress: () => void;
  readonly accessibilityLabel: string;
}

/** Props of {@link Card}: a pressable card requires a summary label. */
export type CardProps = StaticCardProps | PressableCardProps;

/** Inner HeroUI `Surface` with the Bruma card look; its own shadow is clipped, so it is removed. */
function CardSurface({ title, children }: CardBaseProps) {
  return (
    <Surface
      variant="default"
      className="gap-3 rounded-3xl border-2 border-border bg-surface p-4 shadow-none"
    >
      {title === undefined ? null : (
        <Text accessibilityRole="header" className="font-semibold text-heading text-foreground">
          {title}
        </Text>
      )}
      {children}
    </Surface>
  );
}

/**
 * Card of the design system (6.2) on top of the HeroUI `Surface`: card fill, sticker
 * border and shadow, `rounded-3xl`, `p-4` and at most one `text-heading` title. The
 * shadow sits on an outer view because `Surface` clips with `overflow: hidden`. With
 * `onPress`, the whole card is a single button that sinks while pressed.
 */
export function Card(props: CardProps) {
  const press = useStickerPress();
  if (props.onPress === undefined) {
    return (
      <View className={`rounded-3xl ${stickerShadowClasses(false)}`}>
        <CardSurface title={props.title}>{props.children}</CardSurface>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      onPress={props.onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      className={`rounded-3xl ${stickerShadowClasses(press.isPressed)}`}
    >
      <CardSurface title={props.title}>{props.children}</CardSurface>
    </Pressable>
  );
}
