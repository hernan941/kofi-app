import { Button } from 'heroui-native';
import type { Icon as PhosphorIcon } from 'phosphor-react-native';

import { Icon, type IconColor } from './icon';

/** Props of {@link IconButton}; the label is required because there is no visible text. */
export interface IconButtonProps {
  readonly icon: PhosphorIcon;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly isDisabled?: boolean;
  readonly color?: IconColor;
}

/**
 * Button with only an icon ("Editar producto", "Cerrar"). Its touch area is at least
 * 48 × 48 and the screen reader reads `accessibilityLabel`.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  isDisabled = false,
  color = 'foreground',
}: IconButtonProps) {
  return (
    <Button
      variant="ghost"
      isIconOnly
      feedbackVariant="none"
      animation="disable-all"
      isDisabled={isDisabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      className="h-auto min-h-12 min-w-12 rounded-full bg-transparent p-3"
    >
      <Icon icon={icon} color={color} />
    </Button>
  );
}
