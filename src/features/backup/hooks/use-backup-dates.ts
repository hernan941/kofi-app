import { useDependencies } from '@/core/providers/dependencies-context';
import type { EpochMs } from '@/shared/domain';

import { formatBackupDate, type BackupDate } from '../domain/backup-date';

/** Lo que devuelve {@link useBackupDates}. */
export interface BackupDates {
  /** Fecha local de un respaldo, relativa al día de hoy (F8.1, 5.6). */
  readonly formatDate: (createdAt: EpochMs) => BackupDate;
}

/**
 * Da formato a la fecha de un respaldo con el reloj y el calendario de la app. La copia de
 * seguridad se lee con `useLatestSafetyBackup`.
 */
export function useBackupDates(): BackupDates {
  const { clock, calendar } = useDependencies();
  return {
    formatDate: (createdAt) => formatBackupDate(createdAt, clock.now(), calendar),
  };
}
