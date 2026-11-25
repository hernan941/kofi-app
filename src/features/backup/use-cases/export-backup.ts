import { err, ok, type Result } from '@/shared/domain';
import type { LocalCalendar } from '@/shared/domain/calendar/local-calendar';
import type { FileLock } from '@/shared/domain/file-lock';

import type { ExportError } from '../domain/errors';
import { backupFileName } from '../domain/file-names';
import type { BackupFiles, FileSharer } from '../domain/ports';
import type { ExportProgress } from '../domain/progress';
import { requiredBytesForExport } from '../domain/space';
import { collectBackupContents, type BackupContentsDeps } from './collect-backup-contents';
import { writeBackupContents } from './write-backup-contents';

/** Dependencias de {@link exportBackup}. */
export interface ExportBackupDeps extends BackupContentsDeps {
  readonly calendar: LocalCalendar;
  readonly fileLock: FileLock;
  readonly backupFiles: BackupFiles;
  readonly fileSharer: FileSharer;
}

type WriteResult = Result<{ readonly fileName: string; readonly uri: string }, ExportError>;

async function writeBackup(
  deps: ExportBackupDeps,
  onProgress: (progress: ExportProgress) => void,
): Promise<WriteResult> {
  const contents = await collectBackupContents(deps, onProgress);
  if (!contents.ok) {
    return contents;
  }
  const requiredBytes = requiredBytesForExport(contents.value.estimatedBytes);
  if (deps.archiveIo.availableDiskSpace() < requiredBytes) {
    return err({ code: 'not_enough_space', requiredBytes });
  }
  const fileName = backupFileName(deps.calendar.localDateOf(deps.clock.now()));
  const uri = deps.backupFiles.exportTarget(fileName);
  await writeBackupContents(contents.value, uri, deps.archiveIo, onProgress);
  return ok({ fileName, uri });
}

/**
 * Exporta el respaldo (ADR-012, backup.md 4.1): comprueba que haya menú de compartir, toma el
 * lock `backup_export`, junta los contenidos, comprueba el espacio libre y escribe
 * `kofi-respaldo-AAAA-MM-DD.zip` (fecha local de `Clock`) en la caché. Libera el lock
 * siempre (también si algo falla) y recién entonces comparte el archivo. El ZIP no se borra al
 * volver del menú: lo barre la limpieza del próximo arranque.
 */
export async function exportBackup(
  deps: ExportBackupDeps,
  onProgress: (progress: ExportProgress) => void,
): Promise<Result<{ readonly fileName: string }, ExportError>> {
  if (!(await deps.fileSharer.isAvailable())) {
    return err({ code: 'sharing_unavailable' });
  }
  const lease = await deps.fileLock.acquire('backup_export');
  let written: WriteResult;
  try {
    written = await writeBackup(deps, onProgress);
  } finally {
    lease.release();
  }
  if (!written.ok) {
    return written;
  }
  onProgress({ phase: 'sharing' });
  await deps.fileSharer.share(written.value.uri, {
    mimeType: 'application/zip',
    uti: 'public.zip-archive',
  });
  return ok({ fileName: written.value.fileName });
}
