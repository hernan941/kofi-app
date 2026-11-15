import { useEffect, useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, type Text } from 'react-native';

import { useScheduleFrame } from '@/shared/lib/use-schedule-frame';

/**
 * Ref para el título de una vista: al aparecer, el foco de accesibilidad va a él (F8.1, 7). El
 * foco se mueve en el siguiente cuadro, cuando el elemento ya está dibujado.
 */
export function useFocusOnAppear(): React.RefObject<ComponentRef<typeof Text> | null> {
  const title = useRef<ComponentRef<typeof Text>>(null);
  const scheduleFrame = useScheduleFrame();
  useEffect(() => {
    scheduleFrame(() => {
      if (title.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
      }
    });
  }, [scheduleFrame]);
  return title;
}
