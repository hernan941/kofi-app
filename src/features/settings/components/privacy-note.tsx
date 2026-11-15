import { Text, View } from 'react-native';

import { SETTINGS_TEXTS } from './settings-texts';

/** Privacy note (design UX-S3/S4): two paragraphs, without a card, read as one element. */
export function PrivacyNote() {
  const { first, second } = SETTINGS_TEXTS.privacy;
  return (
    <View accessible accessibilityLabel={`${first} ${second}`} className="gap-2">
      <Text className="text-base text-foreground">{first}</Text>
      <Text className="text-base text-muted">{second}</Text>
    </View>
  );
}
