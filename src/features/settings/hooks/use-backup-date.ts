import { useEffect } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';
import { formatBackupDate, useLatestSafetyBackup, type BackupDate } from '@/features/backup';

/**
 * Fecha de la copia de seguridad para el resumen de "Respaldo y planillas", o `null` si no hay
 * copia. Mientras carga o si la lectura falla también es `null`, que es la frase siempre cierta;
 * el problema se registra.
 */
export function useBackupDate(): BackupDate | null {
  const { clock, calendar, logger } = useDependencies();
  const { data, error } = useLatestSafetyBackup();
  useEffect(() => {
    if (error !== null) {
      logger.error('settings_backup_summary_failed', error);
    }
  }, [error, logger]);
  if (data === undefined || data === null) {
    return null;
  }
  return formatBackupDate(data.createdAt, clock.now(), calendar);
}
