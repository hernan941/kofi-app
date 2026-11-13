import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { Text, View } from 'react-native';

import { useAnnounceWhen } from './announce';
import { Card } from './card';
import { Icon } from './icon';
import { SecondaryButton } from './secondary-button';

/** Props of {@link ErrorState}. */
export interface ErrorStateProps {
  readonly message: string;
  readonly onRetry: () => void;
  readonly retryLabel?: string;
}

/**
 * What a screen shows when its data could not load (design system 6.8): a card with the
 * `WarningCircle` icon, a clear message that is announced and a secondary "Reintentar"
 * button.
 */
export function ErrorState({ message, onRetry, retryLabel = 'Reintentar' }: ErrorStateProps) {
  useAnnounceWhen(message);
  return (
    <View className="px-4 pt-4">
      <Card>
        <View className="flex-row items-start gap-2">
          <Icon icon={WarningCircleIcon} color="danger" />
          <Text className="flex-1 text-base text-foreground">{message}</Text>
        </View>
        <SecondaryButton label={retryLabel} onPress={onRetry} />
      </Card>
    </View>
  );
}
