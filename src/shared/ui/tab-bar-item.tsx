import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { Text } from 'react-native';

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
const TAB_LABEL_MAX_LINES = 2;

/**
 * Label of a tab (design system 6.9): `text-xs`, always visible, `font-semibold` and `accent`
 * when active, `font-medium` and `muted` when not. It grows with the system font size up to
 * 1.3 times (section 7) and may use two lines, so a label like "Calendario" is never cut.
 */
export function TabBarLabel({ label, focused }: TabBarLabelProps) {
  return (
    <Text
      maxFontSizeMultiplier={TAB_LABEL_MAX_FONT_SCALE}
      numberOfLines={TAB_LABEL_MAX_LINES}
      className={`text-center text-xs ${focused ? 'font-semibold text-accent' : 'font-medium text-muted'}`}
    >
      {label}
    </Text>
  );
}
