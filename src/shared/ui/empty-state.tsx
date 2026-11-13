import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { Text, View } from 'react-native';

import { Icon } from './icon';
import { PrimaryButton } from './primary-button';
import { SecondaryButton } from './secondary-button';

/** An action offered by a state screen. */
export interface StateAction {
  readonly label: string;
  readonly onPress: () => void;
}

/** Props of {@link EmptyState}. */
export interface EmptyStateProps {
  readonly icon: PhosphorIcon;
  readonly title: string;
  readonly description: string;
  readonly primaryAction?: StateAction;
  readonly secondaryAction?: StateAction;
}

/**
 * What a screen shows when there is nothing yet (design system 6.7): a duotone icon, a
 * positive title, one sentence that says what to do and the main action below. The tone
 * never blames the person.
 */
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <View className="items-center gap-4 px-4 pt-12">
      <Icon icon={icon} size="xl" weight="duotone" color="muted" />
      <View className="items-center gap-2">
        <Text
          accessibilityRole="header"
          className="text-center font-semibold text-heading text-foreground"
        >
          {title}
        </Text>
        <Text className="text-center text-base text-muted">{description}</Text>
      </View>
      {primaryAction === undefined && secondaryAction === undefined ? null : (
        <View className="w-full gap-3 pt-4">
          {primaryAction === undefined ? null : (
            <PrimaryButton label={primaryAction.label} onPress={primaryAction.onPress} />
          )}
          {secondaryAction === undefined ? null : (
            <SecondaryButton label={secondaryAction.label} onPress={secondaryAction.onPress} />
          )}
        </View>
      )}
    </View>
  );
}
