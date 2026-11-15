import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Props of {@link AccessibleGroup}. */
export interface AccessibleGroupProps {
  /** What the screen reader says for the whole group, with amounts already in pesos. */
  readonly label: string;
  readonly children: ReactNode;
  /** Classes of the group itself (spacing between groups). */
  readonly className?: string;
  /** Classes of the box that holds the parts (layout between them). */
  readonly contentClassName?: string;
}

/**
 * Several related parts read as one stop ("Total", "Vendiste" and its amount; the cards of
 * Inicio). The group carries the label and its parts are hidden from the screen reader, so
 * on Android the amount is not a second stop after the group (design system 6.4 and 7).
 */
export function AccessibleGroup({
  label,
  children,
  className,
  contentClassName,
}: AccessibleGroupProps) {
  return (
    <View accessible accessibilityLabel={label} className={className}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className={contentClassName}
      >
        {children}
      </View>
    </View>
  );
}
