import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { NotificationPreferences } from '../domain/preferences';
import { notificationKeys } from './query-keys';

/** Preferencias de avisos del dispositivo; sin fila guardada, los valores por defecto. */
export function useNotificationPreferences(): UseQueryResult<NotificationPreferences> {
  const { preferences } = useDependencies();
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => preferences.get(),
  });
}
