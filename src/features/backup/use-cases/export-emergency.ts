import type { PhotoStorage } from '@/features/products';
import { err, ok, type Result } from '@/shared/domain';
import type { Clock } from '@/shared/domain/calendar/clock';
import type { LocalCalendar } from '@/shared/domain/calendar/local-calendar';
import type { Logger } from '@/shared/lib/logger';

import type { EmergencyExportError, EmergencyExportReason } from '../domain/errors';
import { emergencyFileName } from '../domain/file-names';
import { encodeJson, photoEntryPath } from '../domain/format/contents';
import type { ArchiveIo, BackupFiles, DatabaseCopier, FileSharer } from '../domain/ports';
import { estimateArchiveBytes, requiredBytesForExport } from '../domain/space';
import { writeStoredArchive, type ArchiveEntryInput } from '../domain/zip/archive';
import { bytesEntry, fileEntry, sizeOfFile } from './archive-entries';

/** Dependencias de {@link exportEmergency}. */
export interface EmergencyExportDeps {
  readonly copier: DatabaseCopier;
  readonly photos: Pick<PhotoStorage, 'listFiles' | 'uriFor'>;
  readonly archiveIo: ArchiveIo;
  readonly backupFiles: Pick<
    BackupFiles,
    'emergencyDirectory' | 'clearEmergencyDirectory' | 'discardPicked'
  >;
  readonly fileSharer: FileSharer;
  readonly clock: Clock;
  readonly calendar: LocalCalendar;
  readonly logger: Logger;
  readonly appVersion: string;
}

type DatabaseCopy = Awaited<ReturnType<DatabaseCopier['copyTo']>>;

function joinUri(directoryUri: string, name: string): string {
  return `${directoryUri.replace(/\/+$/, '')}/${name}`;
}

async function describePhotoEntries(deps: EmergencyExportDeps): Promise<ArchiveEntryInput[]> {
  const io = deps.archiveIo;
  const ids = (await deps.photos.listFiles())
    .map((file) => file.id)
    .sort((a, b) => (a === b ? 0 : a < b ? -1 : 1));
  const entries: ArchiveEntryInput[] = [];
  for (const id of ids) {
    const uri = deps.photos.uriFor(id);
    entries.push(fileEntry(io, photoEntryPath(id), uri, await sizeOfFile(io, uri)));
  }
  return entries;
}

async function describeDatabaseEntries(
  io: ArchiveIo,
  copy: DatabaseCopy,
): Promise<ArchiveEntryInput[]> {
  const entries: ArchiveEntryInput[] = [];
  for (const file of copy.files) {
    entries.push(fileEntry(io, file.entryName, file.uri, await sizeOfFile(io, file.uri)));
  }
  return entries;
}

function hasEnoughSpace(
  io: ArchiveIo,
  entries: readonly ArchiveEntryInput[],
): { readonly enough: true } | { readonly enough: false; readonly requiredBytes: number } {
  const requiredBytes = requiredBytesForExport(estimateArchiveBytes(entries));
  return io.availableDiskSpace() < requiredBytes
    ? { enough: false, requiredBytes }
    : { enough: true };
}

async function writeZip(
  io: ArchiveIo,
  uri: string,
  entries: readonly ArchiveEntryInput[],
): Promise<void> {
  const writer = await io.createForWrite(uri);
  try {
    await writeStoredArchive(writer, entries);
  } finally {
    writer.close();
  }
}

/**
 * Exportación de emergencia (ADR-006, backup.md 4.5): vacía la carpeta de emergencia, comprueba
 * que haya espacio para el `info.json` y las fotos (la base se mide después, cuando ya existe su
 * copia), copia la base sin escribir en ella, la empaqueta con las fotos de `photos/` y
 * `info.json` en `kofi-emergencia-AAAA-MM-DD.zip` dentro de esa carpeta, y la comparte.
 * Borra las copias de la base al terminar, también si algo falla (no el ZIP, que la persona puede
 * estar guardando). No usa el snapshot ni `BackupDataV1` (el esquema puede ser desconocido) ni
 * toma el lock (en `failed` la recolección de huérfanos no corre). Las entradas no están en la
 * lista blanca de la restauración, así que la app rechaza ese archivo con `invalid_name`:
 * restaurarlo no se soporta en la v1.
 */
export async function exportEmergency(
  deps: EmergencyExportDeps,
  reason: EmergencyExportReason,
): Promise<Result<void, EmergencyExportError>> {
  if (!(await deps.fileSharer.isAvailable())) {
    return err({ code: 'sharing_unavailable' });
  }
  deps.backupFiles.clearEmergencyDirectory();
  const directory = deps.backupFiles.emergencyDirectory();
  const now = deps.clock.now();
  const info = {
    kind: 'cuantovendi-emergency',
    createdAt: new Date(now).toISOString(),
    appVersion: deps.appVersion,
    reason,
  };
  const photoEntries = await describePhotoEntries(deps);
  const before = hasEnoughSpace(deps.archiveIo, [
    bytesEntry('info.json', encodeJson({ ...info, mode: 'backup_api' })),
    ...photoEntries,
  ]);
  if (!before.enough) {
    return err({ code: 'not_enough_space', requiredBytes: before.requiredBytes });
  }
  let copy: DatabaseCopy;
  try {
    copy = await deps.copier.copyTo(directory);
  } catch (error) {
    deps.logger.error('emergency_export_copy_failed', error, { reason });
    return err({ code: 'database_unavailable' });
  }
  try {
    const entries = [
      bytesEntry('info.json', encodeJson({ ...info, mode: copy.mode })),
      ...(await describeDatabaseEntries(deps.archiveIo, copy)),
      ...photoEntries,
    ];
    const after = hasEnoughSpace(deps.archiveIo, entries);
    if (!after.enough) {
      return err({ code: 'not_enough_space', requiredBytes: after.requiredBytes });
    }
    const zipUri = joinUri(directory, emergencyFileName(deps.calendar.localDateOf(now)));
    await writeZip(deps.archiveIo, zipUri, entries);
    await deps.fileSharer.share(zipUri, { mimeType: 'application/zip', uti: 'public.zip-archive' });
    return ok(undefined);
  } finally {
    for (const file of copy.files) {
      deps.backupFiles.discardPicked(file.uri);
    }
  }
}
