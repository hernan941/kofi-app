import { usePreventRemove } from 'expo-router';

/**
 * Blocks leaving the screen while `active`: the header button, the iOS gesture and the Android
 * back button. Each attempt calls `onBlocked`, for example to announce "Espera a que termine."
 * or to discard something before the screen allows leaving again.
 */
export function usePreventLeave(active: boolean, onBlocked: () => void): void {
  usePreventRemove(active, () => {
    onBlocked();
  });
}
