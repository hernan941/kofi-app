import type { SafetyBackupInfo } from '../domain/ports';
import type { RestoreProgress } from '../domain/progress';
import { BACKUP_ZIP_LIMITS } from '../domain/zip/format';
import { openStoredArchive } from '../domain/zip/archive';
import type { BackupContents } from './collect-backup-contents';
import type { RestoreDeps } from './prepare-restore';
import { writeBackupContents } from './write-backup-contents';

/**
 * Escribe el respaldo de seguridad de lo que hay hoy (D-22): primero en `.part`, lo reabre para
 * validar su estructura, lo renombra al nombre final y solo entonces borra los anteriores. Si algo
 * falla antes del renombrado, el respaldo anterior sigue intacto. Requiere el lock tomado.
 * @throws {Error} Si el archivo escrito no es un ZIP válido.
 */
export async function writeSafetyBackup(
  deps: RestoreDeps,
  contents: BackupContents,
  onProgress: (progress: RestoreProgress) => void,
): Promise<SafetyBackupInfo> {
  const createdAt = deps.clock.now();
  const target = deps.backupFiles.safetyTarget(createdAt);
  await writeBackupContents(contents, target.partUri, deps.archiveIo, (progress) => {
    if (progress.phase === 'writing') {
      onProgress({ phase: 'safety_backup', done: progress.done, total: progress.total });
    }
  });
  const written = await deps.archiveIo.openForRead(target.partUri);
  try {
    const opened = await openStoredArchive(written, BACKUP_ZIP_LIMITS);
    if (!opened.ok) {
      throw new Error(`The safety backup is not valid: ${opened.error}`);
    }
  } finally {
    written.close();
  }
  await deps.backupFiles.promoteSafety(target);
  await deps.backupFiles.pruneSafety(target.finalUri);
  return { uri: target.finalUri, createdAt };
}
