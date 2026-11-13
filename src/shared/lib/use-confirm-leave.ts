import { usePreventRemove } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

/** What {@link useConfirmLeave} returns: the state of the dialog and the ways out. */
export interface ConfirmLeave {
  readonly isOpen: boolean;
  /** Leaves the screen, repeating the navigation that was blocked. */
  readonly confirm: () => void;
  /** Closes the dialog and stays on the screen. */
  readonly cancel: () => void;
  /** Releases the prevention and then runs `action` (for example `router.back()` after saving). */
  readonly leaveWithoutAsking: (action: () => void) => void;
}

/**
 * "Salir sin guardar" for forms (shared by products and sales). While `isDirty` is true it
 * blocks the header button, the iOS gesture and the Android back button with `usePreventRemove`
 * and exposes the state for a `ConfirmDialog`. The blocked navigation or the given action runs
 * only after the prevention is off, in the render that follows. Every call to
 * `leaveWithoutAsking` runs its action, also when the prevention was already released.
 */
export function useConfirmLeave(isDirty: boolean): ConfirmLeave {
  const [isOpen, setIsOpen] = useState(false);
  const [releaseCount, setReleaseCount] = useState(0);
  const pending = useRef<(() => void)[]>([]);
  const isReleased = releaseCount > 0;

  usePreventRemove(isDirty && !isReleased, ({ repeat }) => {
    pending.current = [repeat];
    setIsOpen(true);
  });

  useEffect(() => {
    if (!isReleased) {
      return;
    }
    const actions = pending.current;
    pending.current = [];
    for (const run of actions) run();
  }, [releaseCount, isReleased]);

  return {
    isOpen,
    confirm: () => {
      setIsOpen(false);
      setReleaseCount((count) => count + 1);
    },
    cancel: () => {
      pending.current = [];
      setIsOpen(false);
    },
    leaveWithoutAsking: (action) => {
      pending.current = [...pending.current, action];
      setReleaseCount((count) => count + 1);
    },
  };
}
