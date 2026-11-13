import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { LocalDate } from '@/shared/domain/calendar/local-date';

import { nextTodayRefreshAt } from './time-refresh';

/**
 * Fecha local actual (ADR-009, ADR-015). Se recalcula al pasar la medianoche local, como
 * máximo cada hora y al volver la app a primer plano. Al desmontar limpia el timer y quita
 * el listener de `AppState`.
 */
export function useToday(): LocalDate {
  const { clock, calendar } = useDependencies();
  const [today, setToday] = useState(() => calendar.localDateOf(clock.now()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      const now = clock.now();
      setToday(calendar.localDateOf(now));
      clearTimeout(timer);
      timer = setTimeout(refresh, nextTodayRefreshAt(now, calendar) - now);
    };

    const now = clock.now();
    timer = setTimeout(refresh, nextTodayRefreshAt(now, calendar) - now);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        refresh();
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [clock, calendar]);

  return today;
}
