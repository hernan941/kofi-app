import { useThemeColor } from 'heroui-native';
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';

/** Props of {@link TabBarIcon}. */
export interface TabBarIconProps {
  readonly icon: PhosphorIcon;
  readonly focused: boolean;
}

/** Props of {@link TabBarLabel}. */
export interface TabBarLabelProps {
  readonly label: string;
  readonly focused: boolean;
}

/**
 * Icon of a tab (design system 6.9): `fill` weight and `accent` color when active, `bold`
 * and `muted` when not, so the active tab never depends on color alone.
 */
export function TabBarIcon({ icon, focused }: TabBarIconProps) {
  return (
    <Icon icon={icon} color={focused ? 'accent' : 'muted'} weight={focused ? 'fill' : 'bold'} />
  );
}

const TAB_LABEL_MAX_FONT_SCALE = 1.3;
const TAB_LABEL_MAX_LINES = 1;
const TAB_BUTTON_PADDING = 5;
const TAB_ICON_BOX_HEIGHT = 28;
const TAB_LABEL_LINE_HEIGHT = 18;

/**
 * Label of a tab (design system 6.9): `text-xs`, always visible, `font-semibold` and `accent`
 * when active, `font-medium` and `muted` when not. It grows with the system font size up to
 * 1.3 times (section 7), stays on one line and shrinks to fit (`adjustsFontSizeToFit`), so a
 * label like "Calendario" is never cut in the middle of the word. `self-stretch` gives it the
 * whole width of the tab and `-mx-1` recovers part of the padding of the tab button.
 */
export function TabBarLabel({ label, focused }: TabBarLabelProps) {
  return (
    <Text
      maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
      numberOfLines={TAB_LABEL_MAX_LINES}
      adjustsFontSizeToFit
      className={`-mx-1 self-stretch text-center text-xs ${focused ? 'font-semibold text-accent' : 'font-medium text-muted'}`}
    >
      {label}
    </Text>
  );
}

/**
 * Height of the tab bar for the system font scale. A tab needs the padding of the button of
 * `expo-router` on both sides, the icon box, one line of label (`text-xs`) and the top border (`hairlineWidth`); the label line
 * grows with the font scale, clamped between 1 and 1.3 like {@link TabBarLabel}. The bottom
 * inset (gesture bar) is added on top.
 */
export function tabBarHeight(fontScale: number, bottomInset: number): number {
  const scale = Math.min(Math.max(fontScale, 1), TAB_LABEL_MAX_FONT_SCALE);
  const content =
    TAB_BUTTON_PADDING +
    TAB_ICON_BOX_HEIGHT +
    TAB_LABEL_LINE_HEIGHT * scale +
    TAB_BUTTON_PADDING +
    StyleSheet.hairlineWidth;
  return Math.ceil(content) + bottomInset;
}

/** Style of the tab bar: theme colors and a height that follows the system font size. */
export function useTabBarStyle() {
  const [backgroundColor, borderTopColor] = useThemeColor(['surface', 'border']);
  const { fontScale } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  return { backgroundColor, borderTopColor, height: tabBarHeight(fontScale, bottom) };
}
