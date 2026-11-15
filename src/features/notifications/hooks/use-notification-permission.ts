import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { NotificationPermission } from '../domain/ports';
import { notificationKeys } from './query-keys';

/** Estado del permiso; `undefined` mientras se lee. */
export interface NotificationPermissionState {
  readonly permission: NotificationPermission | undefined;
  /** El problema de la última lectura, o `null`. */
  readonly error: Error | null;
}

/**
 * Permiso de avisos del sistema. Se vuelve a leer al volver a primer plano, porque la persona
 * pudo cambiarlo en los ajustes del teléfono. Si la lectura falla, queda `undefined`.
 */
export function useNotificationPermission(): NotificationPermissionState {
  const { notifications } = useDependencies();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: notificationKeys.permission(),
    queryFn: () => notifications.getPermission(),
  });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.permission() });
      }
    });
    return () => {
      subscription.remove();
    };
  }, [queryClient]);
  return { permission: query.data, error: query.error };
}
