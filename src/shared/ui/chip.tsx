import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { Pressable, Text } from 'react-native';

import { Icon } from './icon';

/**
 * How a chip is read: `toggle` is a button with the `selected` state (filters) and
 * `radio` is one option of a {@link ChipGroup}, with the `checked` state.
 */
export type ChipRole = 'toggle' | 'radio';

/** Props of {@link Chip}. */
export interface ChipProps {
  readonly label: string;
  readonly isSelected: boolean;
  readonly onPress: () => void;
  readonly role?: ChipRole;
}

/**
 * Pill to pick an option (design system 6.5), at least 48 tall and without shadow. Not
 * selected: `field-border` outline. Selected: accent fill with the `Check` icon in front,
 * so the state never depends on color alone.
 */
export function Chip({ label, isSelected, onPress, role = 'toggle' }: ChipProps) {
  const isRadio = role === 'radio';
  return (
    <Pressable
      accessibilityRole={isRadio ? 'radio' : 'button'}
      accessibilityLabel={label}
      accessibilityState={isRadio ? { checked: isSelected } : { selected: isSelected }}
      onPress={onPress}
      className={`min-h-12 flex-row items-center justify-center gap-2 rounded-full border-2 px-4 py-2 ${
        isSelected ? 'border-accent bg-accent' : 'border-field-border bg-transparent'
      }`}
    >
      {isSelected ? <Icon icon={CheckIcon} size="md" color="accent-foreground" /> : null}
      <Text
        className={`font-medium text-sm ${isSelected ? 'text-accent-foreground' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
