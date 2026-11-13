import { Button } from 'heroui-native';
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import type { ComponentRef, Ref } from 'react';

import { Icon, type IconColor } from './icon';
import { stickerShadowClasses, useStickerPress } from './use-sticker-press';

/** Native handle of a labelled button. */
export type ButtonHandle = ComponentRef<typeof Button>;

/** Visual tone of a button of the design system (section 6.1). */
export type ButtonTone = 'primary' | 'secondary' | 'text' | 'danger' | 'danger-filled';

/** Props shared by every labelled button. */
export interface ButtonBaseProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: PhosphorIcon;
  readonly accessibilityHint?: string;
  /** Native handle of the button, for example to move the accessibility focus to it. */
  readonly ref?: Ref<ButtonHandle>;
}

/** Props of {@link ButtonBase}. */
interface ButtonBaseInternalProps extends ButtonBaseProps {
  readonly tone: ButtonTone;
  readonly isDisabled?: boolean;
}

interface ToneStyle {
  readonly root: string;
  readonly label: string;
  readonly icon: IconColor;
  readonly hasShadow: boolean;
}

const TONES: Readonly<Record<ButtonTone, ToneStyle>> = {
  primary: {
    root: 'min-h-13 w-full border-2 border-border bg-accent px-6 py-3',
    label: 'text-accent-foreground',
    icon: 'accent-foreground',
    hasShadow: true,
  },
  secondary: {
    root: 'min-h-12 border-2 border-border bg-surface px-5 py-2',
    label: 'text-foreground',
    icon: 'foreground',
    hasShadow: false,
  },
  text: {
    root: 'min-h-12 bg-transparent px-3 py-2',
    label: 'text-accent',
    icon: 'accent',
    hasShadow: false,
  },
  danger: {
    root: 'min-h-12 border-2 border-border bg-surface px-5 py-2',
    label: 'text-danger',
    icon: 'danger',
    hasShadow: false,
  },
  'danger-filled': {
    root: 'min-h-12 border-2 border-border bg-danger px-5 py-2',
    label: 'text-danger-foreground',
    icon: 'danger-foreground',
    hasShadow: false,
  },
};

/**
 * Common implementation of the labelled buttons, on top of the HeroUI `Button` with its
 * own press feedback turned off: the sticker press replaces it. Heights are minimums so
 * the label can grow with the system font size.
 */
export function ButtonBase({
  label,
  onPress,
  icon,
  accessibilityHint,
  tone,
  isDisabled = false,
  ref,
}: ButtonBaseInternalProps) {
  const style = TONES[tone];
  const press = useStickerPress();
  const shadow = style.hasShadow && !isDisabled ? stickerShadowClasses(press.isPressed) : '';
  return (
    <Button
      ref={ref}
      feedbackVariant="none"
      animation="disable-all"
      isDisabled={isDisabled}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      className={`h-auto gap-2 rounded-full ${style.root} ${shadow}`}
    >
      {icon ? <Icon icon={icon} color={style.icon} /> : null}
      <Button.Label className={`text-center font-semibold text-base ${style.label}`}>
        {label}
      </Button.Label>
    </Button>
  );
}
