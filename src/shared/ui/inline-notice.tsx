import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
import { Text, View } from 'react-native';

import { useAnnounceWhen } from './announce';
import { Icon, type IconColor } from './icon';
import { CheckCircleIcon, InfoIcon, WarningCircleIcon } from './icons';

/** Tone of an {@link InlineNotice}: quiet note, confirmation or problem. */
export type InlineNoticeTone = 'info' | 'success' | 'danger';

/** Props of {@link InlineNotice}. */
export interface InlineNoticeProps {
  readonly message: string;
  readonly tone?: InlineNoticeTone;
  /** Replaces the icon of the tone. */
  readonly icon?: PhosphorIcon;
}

interface ToneLook {
  readonly icon: PhosphorIcon;
  readonly iconColor: IconColor;
  readonly iconWeight: IconWeight;
  readonly textClassName: string;
  readonly isAnnounced: boolean;
}

const TONE_LOOKS: Readonly<Record<InlineNoticeTone, ToneLook>> = {
  info: {
    icon: InfoIcon,
    iconColor: 'muted',
    iconWeight: 'bold',
    textClassName: 'text-muted',
    isAnnounced: false,
  },
  success: {
    icon: CheckCircleIcon,
    iconColor: 'accent',
    iconWeight: 'fill',
    textClassName: 'text-foreground',
    isAnnounced: true,
  },
  danger: {
    icon: WarningCircleIcon,
    iconColor: 'danger',
    iconWeight: 'bold',
    textClassName: 'text-foreground',
    isAnnounced: true,
  },
};

/**
 * Note inside a screen with no border, shadow or fill, so it does not compete with cards. It
 * reads as one element. `info` (default) is the quiet muted note ("Está archivado…"); `success`
 * and `danger` carry the check or the warning icon with `foreground` text (the icon and the
 * text say it, the color only accompanies) and are announced when they appear or change.
 */
export function InlineNotice({ message, tone = 'info', icon }: InlineNoticeProps) {
  const look = TONE_LOOKS[tone];
  useAnnounceWhen(look.isAnnounced ? message : undefined);
  return (
    <View accessible accessibilityLabel={message} className="flex-row items-start gap-2">
      <Icon
        icon={icon ?? look.icon}
        size="md"
        color={look.iconColor}
        weight={icon === undefined ? look.iconWeight : 'bold'}
      />
      <Text className={`flex-1 text-sm ${look.textClassName}`}>{message}</Text>
    </View>
  );
}
