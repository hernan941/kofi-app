import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Announces a message to VoiceOver or TalkBack without moving the focus. Used for errors,
 * confirmations and any change that is not visible where the focus is.
 */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

/**
 * Announces `message` every time it changes to a new non-empty value, for example when a
 * validation error appears. Repeating the same message or clearing it does not announce.
 */
export function useAnnounceWhen(message: string | undefined): void {
  useEffect(() => {
    if (message) {
      announce(message);
    }
  }, [message]);
}
