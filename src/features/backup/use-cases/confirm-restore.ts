import { err, ok, type Result } from '@/shared/domain';

import type { RestoreError } from '../domain/errors';
import { photoEntryPath } from '../domain/format/contents';
import type { RandomAccessFile, SafetyBackupInfo } from '../domain/ports';
import type { RestoreProgress } from '../domain/progress';
import { requiredBytesForRestore } from '../domain/space';
import { openStoredArchive } from '../domain/zip/archive';
import { collectBackupContents } from './collect-backup-contents';
import type { RestoreDeps, RestorePhoto, RestorePlan } from './prepare-restore';
import { writeSafetyBackup } from './safety-backup';

/** Resultado de una restauración confirmada. */
export interface RestoreOutcome {
  readonly safetyBackup: SafetyBackupInfo;
  readonly copiedPhotos: number;
  readonly skippedPhotos: number;
}

type Progress = (progress: RestoreProgress) => void;

async function sourceMatchesPlan(
  deps: RestoreDeps,
  file: RandomAccessFile,
  plan: RestorePlan,
): Promise<boolean> {
  if (file.size !== plan.archiveSize) {
    return false;
  }
  const opened = await openStoredArchive(file, deps.limits);
  if (!opened.ok || opened.value.entries.size !== plan.photos.length + 2) {
    return false;
  }
  return plan.photos.every((photo) => {
    const entry = opened.value.entries.get(photoEntryPath(photo.id));
    return entry?.dataOffset === photo.dataOffset && entry.size === photo.size;
  });
}

async function copyPhoto(
  deps: RestoreDeps,
  source: RandomAccessFile,
  photo: RestorePhoto,
): Promise<Result<void, RestoreError>> {
  const partialUri = deps.photos.partialUriFor(photo.id);
  await deps.archiveIo.copyRange(source, photo.dataOffset, photo.size, partialUri);
  if ((await deps.archiveIo.sha256OfFile(partialUri)) !== photo.sha256) {
    await deps.photos.removePartial(photo.id);
    return err({ code: 'checksum_mismatch', path: photoEntryPath(photo.id) });
  }
  await deps.photos.promotePartial(photo.id);
  return ok(undefined);
}

async function copyPhotos(
  deps: RestoreDeps,
  source: RandomAccessFile,
  plan: RestorePlan,
  existing: ReadonlySet<string>,
  onProgress: Progress,
): Promise<Result<{ copied: number; skipped: number }, RestoreError>> {
  let copied = 0;
  let skipped = 0;
  for (const photo of plan.photos) {
    onProgress({ phase: 'copying_photos', done: copied + skipped, total: plan.photos.length });
    if (existing.has(photo.id)) {
      if ((await deps.archiveIo.sha256OfFile(deps.photos.uriFor(photo.id))) !== photo.sha256) {
        return err({ code: 'photo_conflict', photoId: photo.id });
      }
      skipped += 1;
      continue;
    }
    const result = await copyPhoto(deps, source, photo);
    if (!result.ok) {
      return result;
    }
    copied += 1;
  }
  onProgress({ phase: 'copying_photos', done: plan.photos.length, total: plan.photos.length });
  return ok({ copied, skipped });
}

async function applyRestore(
  deps: RestoreDeps,
  source: RandomAccessFile,
  plan: RestorePlan,
  onProgress: Progress,
): Promise<Result<RestoreOutcome, RestoreError>> {
  if (!(await sourceMatchesPlan(deps, source, plan))) {
    return err({ code: 'entries_mismatch' });
  }
  onProgress({ phase: 'checking_space' });
  const current = await collectBackupContents(deps, () => undefined);
  if (!current.ok) {
    if (current.error.code === 'too_large') {
      return err({ code: 'current_data_too_large' });
    }
    throw new Error(`The current data cannot be backed up before restoring: ${current.error.code}`);
  }
  const existing = new Set((await deps.photos.listFiles()).map((file) => file.id));
  const requiredBytes = requiredBytesForRestore({
    safetyArchiveBytes: current.value.estimatedBytes,
    photosToCopyBytes: plan.photos
      .filter((photo) => !existing.has(photo.id))
      .reduce((total, photo) => total + photo.size, 0),
  });
  if (deps.archiveIo.availableDiskSpace() < requiredBytes) {
    return err({ code: 'not_enough_space', requiredBytes });
  }
  const safetyBackup = await writeSafetyBackup(deps, current.value, onProgress);
  const photos = await copyPhotos(deps, source, plan, existing, onProgress);
  if (!photos.ok) {
    return photos;
  }
  onProgress({ phase: 'applying' });
  await deps.yieldToUi();
  await deps.store.replaceAll(plan.snapshot);
  return ok({
    safetyBackup,
    copiedPhotos: photos.value.copied,
    skippedPhotos: photos.value.skipped,
  });
}

/**
 * Pasos 6 a 11 de ADR-012. Con el lock `backup_restore` tomado: comprueba que la fuente siga
 * siendo la que se vio en la vista previa, comprueba el espacio libre una sola vez, escribe el
 * respaldo de seguridad (D-22), copia cada foto a `.part`, verifica su `sha256` y la renombra, y
 * reemplaza las siete tablas en una sola transacción (que emite `DataChanges` y, con ello, la
 * reconciliación de notificaciones). Si los datos actuales superan `BACKUP_ZIP_LIMITS` no se podría
 * guardar su copia de seguridad y responde `current_data_too_large` sin escribir. Cualquier error antes del commit deja intactos los datos;
 * las fotos ya copiadas quedan huérfanas y las limpia la recolección. Libera el lock, cierra el
 * archivo y descarta la copia del selector siempre: el lock se libera aunque falle el último
 * aviso de progreso o el cierre del archivo.
 */
export async function confirmRestore(
  deps: RestoreDeps,
  plan: RestorePlan,
  onProgress: Progress,
): Promise<Result<RestoreOutcome, RestoreError>> {
  const lease = await deps.fileLock.acquire('backup_restore');
  let source: RandomAccessFile | null = null;
  try {
    source = await deps.archiveIo.openForRead(plan.sourceUri);
    return await applyRestore(deps, source, plan, onProgress);
  } finally {
    try {
      onProgress({ phase: 'finishing' });
      source?.close();
    } finally {
      lease.release();
      deps.backupFiles.discardPicked(plan.sourceUri);
    }
  }
}
