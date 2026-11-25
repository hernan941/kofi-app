import { act, renderHook } from '@testing-library/react-native';
import { Keyboard, Platform, type KeyboardEventName } from 'react-native';

import { useIsKeyboardVisible } from './use-is-keyboard-visible';

type Listener = () => void;

/** Replaces `Keyboard.addListener` with a recorder and returns the registered listeners and one `remove` spy per subscription. */
function recordKeyboardListeners() {
  const listeners = new Map<string, Listener>();
  const removers = new Map<string, jest.Mock>();
  jest.spyOn(Keyboard, 'addListener').mockImplementation((name: KeyboardEventName, listener) => {
    const remove = jest.fn();
    listeners.set(name, listener as Listener);
    removers.set(name, remove);
    return { remove };
  });
  return { listeners, removers };
}

describe('useIsKeyboardVisible', () => {
  it('starts with what Keyboard.isVisible reports', async () => {
    recordKeyboardListeners();
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);

    const { result } = await renderHook(() => useIsKeyboardVisible());

    expect(result.current).toBe(true);
  });

  it('follows the "will" events on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { listeners } = recordKeyboardListeners();
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const { result } = await renderHook(() => useIsKeyboardVisible());

    await act(() => {
      listeners.get('keyboardWillShow')?.();
    });
    expect(result.current).toBe(true);

    await act(() => {
      listeners.get('keyboardWillHide')?.();
    });
    expect(result.current).toBe(false);
    expect(listeners.has('keyboardDidShow')).toBe(false);
  });

  it('follows the "did" events on Android', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { listeners } = recordKeyboardListeners();
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const { result } = await renderHook(() => useIsKeyboardVisible());

    await act(() => {
      listeners.get('keyboardDidShow')?.();
    });
    expect(result.current).toBe(true);

    await act(() => {
      listeners.get('keyboardDidHide')?.();
    });
    expect(result.current).toBe(false);
    expect(listeners.has('keyboardWillShow')).toBe(false);
  });

  it('removes every subscription when it unmounts', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { removers } = recordKeyboardListeners();
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const { unmount } = await renderHook(() => useIsKeyboardVisible());

    await unmount();

    expect([...removers.keys()].sort()).toEqual(['keyboardDidHide', 'keyboardDidShow']);
    expect(removers.get('keyboardDidShow')).toHaveBeenCalledTimes(1);
    expect(removers.get('keyboardDidHide')).toHaveBeenCalledTimes(1);
  });
});
