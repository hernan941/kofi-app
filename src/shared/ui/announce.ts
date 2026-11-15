import { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Announces a message to VoiceOver or TalkBack without moving the focus. Used for errors,
 * confirmations and any change that is not visible where the focus is.
 */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

function isAlways(): boolean {
  return true;
}

/**
 * Announces `message` every time it changes to a new non-empty value, for example when a
 * validation error appears. Repeating the same message or clearing it does not announce.
 * When `isEnabled()` returns false at that moment the change is skipped: used when a summary
 * announces it instead.
 */
export function useAnnounceWhen(
  message: string | undefined,
  isEnabled: () => boolean = isAlways,
): void {
  const announceIfEnabled = useEffectEvent((text: string) => {
    if (isEnabled()) announce(text);
  });
  useEffect(() => {
    if (message) {
      announceIfEnabled(message);
    }
  }, [message]);
}
