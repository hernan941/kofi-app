import { Text, View } from 'react-native';

import { CaretLeftIcon } from './icons';
import { IconButton } from './icon-button';

/** Props of {@link ScreenHeader}. */
export interface ScreenHeaderProps {
  readonly title?: string;
  readonly onBack?: () => void;
}

/**
 * Header drawn by each screen, since the native ones are hidden: optional "Volver" button
 * (48 × 48) and the title as a `header` that wraps onto several lines instead of being cut.
 */
export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-start gap-2 px-4 pt-2 pb-4">
      {onBack === undefined ? null : (
        <IconButton icon={CaretLeftIcon} accessibilityLabel="Volver" onPress={onBack} />
      )}
      {title === undefined ? null : (
        <Text
          accessibilityRole="header"
          className="flex-1 pt-2 font-semibold text-title text-foreground"
        >
          {title}
        </Text>
      )}
    </View>
  );
}
