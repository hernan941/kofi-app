import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { NotificationPreferences } from '../domain/preferences';
import { notificationKeys } from './query-keys';

/**
 * Guarda las preferencias con el instante actual. El aviso de `DataChanges` invalida la
 * consulta y dispara la reconciliación; la pantalla no hace nada más. Un fallo se registra y
 * se propaga para que la pantalla lo muestre.
 */
export function useSaveNotificationPreferences(): UseMutationResult<
  void,
  Error,
  NotificationPreferences
> {
  const { preferences, clock, logger } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    onSuccess: (_result, saved) => {
      queryClient.setQueryData(notificationKeys.preferences(), saved);
    },
    mutationFn: async (next) => {
      try {
        await preferences.save(next, clock.now());
      } catch (error) {
        logger.error('save_notification_preferences_failed', error);
        throw error;
      }
    },
  });
}
