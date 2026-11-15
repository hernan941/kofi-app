import type { FileLock } from '@/shared/domain/file-lock';
import type { Clock } from '@/shared/domain/calendar/clock';
import type { Logger } from '@/shared/lib/logger';

import type { BackupFiles } from '../domain/ports';

/** Antigüedad mínima de un temporal de respaldos para que la limpieza lo borre: 15 minutos. */
export const BACKUP_TEMPORARY_MIN_AGE_MS = 900_000;

/** Dependencias de {@link cleanupBackupTemporaries}. */
export interface CleanupDeps {
  readonly backupFiles: Pick<BackupFiles, 'sweep'>;
  readonly fileLock: FileLock;
  readonly clock: Clock;
  readonly logger: Logger;
}

/**
 * Limpieza de arranque (backup.md 4.6): con `tryAcquire('backup_cleanup')` borra los temporales
 * de respaldos con más de 15 minutos y los respaldos de seguridad sobrantes. Si el lock está
 * ocupado (hay una exportación o restauración en curso) no hace nada.
 */
export async function cleanupBackupTemporaries(
  deps: CleanupDeps,
): Promise<{ readonly removed: number }> {
  const lease = deps.fileLock.tryAcquire('backup_cleanup');
  if (lease === null) {
    deps.logger.info('backup_cleanup_skipped');
    return { removed: 0 };
  }
  try {
    const result = await deps.backupFiles.sweep(deps.clock.now(), BACKUP_TEMPORARY_MIN_AGE_MS);
    deps.logger.info('backup_cleanup_done', { removed: result.removed });
    return result;
  } finally {
    lease.release();
  }
}
