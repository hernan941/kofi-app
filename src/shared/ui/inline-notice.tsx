import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { Text, View } from 'react-native';

import { Icon } from './icon';
import { InfoIcon } from './icons';

/** Props of {@link InlineNotice}. */
export interface InlineNoticeProps {
  readonly message: string;
  readonly icon?: PhosphorIcon;
}

/**
 * Quiet note inside a screen ("Está archivado…"): a muted icon and text, with no border,
 * shadow or fill so it does not compete with cards. It reads as one element. Errors do not
 * use it: they are `danger` with `WarningCircle`.
 */
export function InlineNotice({ message, icon = InfoIcon }: InlineNoticeProps) {
  return (
    <View accessible accessibilityLabel={message} className="flex-row items-start gap-2">
      <Icon icon={icon} size="md" color="muted" />
      <Text className="flex-1 text-sm text-muted">{message}</Text>
    </View>
  );
}
