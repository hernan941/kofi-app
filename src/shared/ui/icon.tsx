import { useThemeColor, type ThemeColor } from 'heroui-native';
import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
import { View } from 'react-native';

/** Icon sizes of the design system (section 8): 16, 20, 24 and 48. */
export const ICON_SIZES = { sm: 16, md: 20, lg: 24, xl: 48 } as const;

/** Name of an icon size: `sm` next to error messages, `md` in rows and chips, `lg` by default, `xl` in empty states. */
export type IconSize = keyof typeof ICON_SIZES;

/** Theme colors an icon may take; the accent follows the same rules as text. */
export type IconColor = Extract<
  ThemeColor,
  'foreground' | 'muted' | 'accent' | 'accent-foreground' | 'danger' | 'danger-foreground'
>;

/** Props of {@link Icon}. */
export interface IconProps {
  readonly icon: PhosphorIcon;
  readonly size?: IconSize;
  readonly color?: IconColor;
  readonly weight?: IconWeight;
}

/**
 * Draws a Phosphor icon, imported one by one (`phosphor-react-native/src/icons/<Name>`),
 * with a theme color and a size from the scale. The icon is always decorative: it is
 * hidden from the screen reader, so the element that contains it carries the label.
 */
export function Icon({
  icon: Glyph,
  size = 'lg',
  color = 'foreground',
  weight = 'bold',
}: IconProps) {
  const resolvedColor = useThemeColor(color);
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Glyph size={ICON_SIZES[size]} color={resolvedColor} weight={weight} />
    </View>
  );
}
