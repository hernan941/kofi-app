import { photoEntryPath } from '../domain/format/contents';
import type { ArchiveIo } from '../domain/ports';
import type { ExportProgress } from '../domain/progress';
import { writeStoredArchive, type ArchiveEntryInput } from '../domain/zip/archive';
import { bytesEntry, fileEntry } from './archive-entries';
import type { BackupContents } from './collect-backup-contents';

/**
 * Escribe el ZIP STORED de un `BackupContents` en `targetUri`: `manifest.json`, `data.json` y
 * las fotos por id ascendente. Requiere el lock de archivos tomado por quien llama. Cierra el
 * escritor también si falla; un archivo a medias lo borra la limpieza del próximo arranque.
 */
export async function writeBackupContents(
  contents: BackupContents,
  targetUri: string,
  io: ArchiveIo,
  onProgress: (progress: ExportProgress) => void,
): Promise<void> {
  const entries: ArchiveEntryInput[] = [
    bytesEntry('manifest.json', contents.manifestBytes),
    bytesEntry('data.json', contents.dataBytes),
    ...contents.photoFiles.map((photo) =>
      fileEntry(io, photoEntryPath(photo.id), photo.uri, photo.size),
    ),
  ];
  const writer = await io.createForWrite(targetUri);
  try {
    await writeStoredArchive(writer, entries, (done, total) => {
      onProgress({ phase: 'writing', done, total });
    });
  } finally {
    writer.close();
  }
}
