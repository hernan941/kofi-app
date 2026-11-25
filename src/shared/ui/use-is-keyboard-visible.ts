import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the software keyboard is open. It starts with `Keyboard.isVisible()` and listens to
 * the "will" events on iOS and the "did" events on Android, which does not emit the "will" ones.
 * The subscriptions are removed on unmount.
 */
export function useIsKeyboardVisible(): boolean {
  const [isVisible, setIsVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const isIos = Platform.OS === 'ios';
    const show = Keyboard.addListener(isIos ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setIsVisible(true);
    });
    const hide = Keyboard.addListener(isIos ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setIsVisible(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return isVisible;
}
