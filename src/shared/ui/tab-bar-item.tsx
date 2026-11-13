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

/**
 * Label of a tab (design system 6.9): `text-xs`, always visible, `font-semibold` and `accent`
 * when active, `font-medium` and `muted` when not. It grows with the system font size up to
 * 1.5 times (section 7).
 */
export function TabBarLabel({ label, focused }: TabBarLabelProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.5}
      numberOfLines={1}
      className={`text-xs ${focused ? 'font-semibold text-accent' : 'font-medium text-muted'}`}
    >
      {label}
    </Text>
  );
}
