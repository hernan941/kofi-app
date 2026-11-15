import { useEffect } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';

import { summarizeReminders, type ReminderSummary } from '../domain/reminder-summary';
import { useNotificationPermission } from './use-notification-permission';
import { useNotificationPreferences } from './use-notification-preferences';

/**
 * Resumen del estado de los recordatorios para Ajustes. Combina las preferencias y el permiso,
 * que ya se invalidan al guardar y al volver a primer plano. Si una lectura falla, queda en
 * `loading` (la fila se muestra sin subtítulo) y el problema se registra.
 */
export function useReminderSummary(): ReminderSummary {
  const { logger } = useDependencies();
  const preferences = useNotificationPreferences();
  const { permission, error: permissionError } = useNotificationPermission();
  const error = preferences.error ?? permissionError;
  useEffect(() => {
    if (error !== null) {
      logger.error('reminder_summary_failed', error);
    }
  }, [error, logger]);
  return summarizeReminders(preferences.data, permission);
}
