import type { PhotoStorage } from '@/features/products';
import { err, ok, type ProductPhotoId, type Result } from '@/shared/domain';
import type { Clock } from '@/shared/domain/calendar/clock';
import type { Logger } from '@/shared/lib/logger';

import type { BackupStore } from '../data/backup-store';
import type { ExportError } from '../domain/errors';
import { prepareExportSnapshot, type DiskPhoto } from '../domain/format/export-snapshot';
import {
  buildManifest,
  encodeJson,
  photoEntryPath,
  photoIdFromEntryPath,
} from '../domain/format/contents';
import { backupDataV1Schema } from '../domain/format/backup-data-v1';
import { checkIntegrity } from '../domain/format/integrity';
import type { BackupManifestV1 } from '../domain/format/manifest';
import { snapshotToBackupData } from '../domain/format/mapping';
import type { ArchiveIo } from '../domain/ports';
import type { ExportProgress } from '../domain/progress';
import { estimateArchiveBytes } from '../domain/space';
import { BACKUP_ZIP_LIMITS } from '../domain/zip/format';
import { sizeOfFile } from './archive-entries';

/** Dependencias de {@link collectBackupContents}. */
export interface BackupContentsDeps {
  readonly store: Pick<BackupStore, 'readSnapshot'>;
  readonly photos: Pick<PhotoStorage, 'listFiles' | 'uriFor'>;
  readonly archiveIo: ArchiveIo;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly appVersion: string;
}

/** Una foto activa con su archivo, tal como irá en el ZIP. */
export interface BackupPhotoFile {
  readonly id: ProductPhotoId;
  readonly uri: string;
  readonly size: number;
  readonly sha256: string;
}

/** Todo lo necesario para escribir un respaldo, sin escribir nada. */
export interface BackupContents {
  readonly manifest: BackupManifestV1;
  readonly manifestBytes: Uint8Array;
  readonly dataBytes: Uint8Array;
  readonly photoFiles: readonly BackupPhotoFile[];
  readonly estimatedBytes: number;
}

const TOO_LARGE: Result<never, ExportError> = err({ code: 'too_large' });
const INCONSISTENT: Result<never, ExportError> = err({ code: 'inconsistent_data' });
const MAX_LOGGED_ISSUES = 20;

async function describeFile(io: ArchiveIo, uri: string): Promise<DiskPhoto> {
  return { byteSize: await sizeOfFile(io, uri), sha256: await io.sha256OfFile(uri) };
}

async function hashActivePhotos(
  deps: BackupContentsDeps,
  ids: readonly ProductPhotoId[],
  onProgress: (progress: ExportProgress) => void,
): Promise<Map<ProductPhotoId, DiskPhoto>> {
  const described = new Map<ProductPhotoId, DiskPhoto>();
  for (const id of ids) {
    onProgress({ phase: 'hashing_photos', done: described.size, total: ids.length });
    described.set(id, await describeFile(deps.archiveIo, deps.photos.uriFor(id)));
  }
  if (ids.length > 0) {
    onProgress({ phase: 'hashing_photos', done: ids.length, total: ids.length });
  }
  return described;
}

function exceedsLimits(
  entries: readonly { readonly path: string; readonly size: number }[],
  estimatedBytes: number,
): boolean {
  return (
    entries.length > BACKUP_ZIP_LIMITS.maxEntries ||
    estimatedBytes > BACKUP_ZIP_LIMITS.maxArchiveBytes ||
    entries.some((entry) => entry.size > BACKUP_ZIP_LIMITS.maxEntryBytes)
  );
}

/**
 * Lee la instantánea, calcula el `sha256` de cada foto activa desde el disco, arma `data.json`
 * y el manifiesto en memoria y estima el tamaño del ZIP, sin escribir nada. Requiere el lock de
 * archivos tomado por quien llama. Responde `too_large` si el respaldo superaría
 * `BACKUP_ZIP_LIMITS` e `inconsistent_data` (y lo registra, solo con rutas) si los datos no pasan
 * `backupDataV1Schema` ni `checkIntegrity`, para no producir uno que la app no podría restaurar.
 */
export async function collectBackupContents(
  deps: BackupContentsDeps,
  onProgress: (progress: ExportProgress) => void,
): Promise<Result<BackupContents, ExportError>> {
  onProgress({ phase: 'reading' });
  const snapshot = await deps.store.readSnapshot();
  const present = new Set((await deps.photos.listFiles()).map((file) => file.id));
  const ids = snapshot.productPhotos
    .filter((row) => row.deletedAt === null && present.has(row.id))
    .map((row) => row.id);
  const diskPhotos = await hashActivePhotos(deps, ids, onProgress);

  const now = deps.clock.now();
  const prepared = prepareExportSnapshot(snapshot, diskPhotos, now);
  logWarnings(deps.logger, prepared.warnings);

  const data = snapshotToBackupData(prepared.snapshot);
  const schema = backupDataV1Schema.safeParse(data);
  if (!schema.success) {
    const issues = schema.error.issues
      .slice(0, MAX_LOGGED_ISSUES)
      .map((issue) => issue.path.join('.'));
    deps.logger.error('backup_data_inconsistent', schema.error, { issues });
    return INCONSISTENT;
  }
  const dataBytes = encodeJson(data);
  if (dataBytes.length > BACKUP_ZIP_LIMITS.maxDataJsonBytes) {
    return TOO_LARGE;
  }
  const manifest = buildManifest({
    now,
    appVersion: deps.appVersion,
    data,
    dataFile: { byteSize: dataBytes.length, sha256: await deps.archiveIo.sha256OfBytes(dataBytes) },
  });
  const integrity = checkIntegrity(data, manifest);
  if (!integrity.ok) {
    deps.logger.error('backup_data_inconsistent', new Error(integrity.error.code), {
      issues: 'issues' in integrity.error ? integrity.error.issues : [],
    });
    return INCONSISTENT;
  }
  const manifestBytes = encodeJson(manifest);
  const photoFiles = manifest.files.slice(1).flatMap((file) => {
    const id = photoIdFromEntryPath(file.path);
    return id === null
      ? []
      : [{ id, uri: deps.photos.uriFor(id), size: file.byteSize, sha256: file.sha256 }];
  });
  const entries = [
    { path: 'manifest.json', size: manifestBytes.length },
    { path: 'data.json', size: dataBytes.length },
    ...photoFiles.map((photo) => ({ path: photoEntryPath(photo.id), size: photo.size })),
  ];
  const estimatedBytes = estimateArchiveBytes(entries);
  if (exceedsLimits(entries, estimatedBytes)) {
    return TOO_LARGE;
  }
  return ok({ manifest, manifestBytes, dataBytes, photoFiles, estimatedBytes });
}

function logWarnings(
  logger: Logger,
  warnings: { readonly hashMismatches: number; readonly missingFiles: number },
): void {
  if (warnings.hashMismatches > 0) {
    logger.warn('backup_photo_hash_mismatch', { count: warnings.hashMismatches });
  }
  if (warnings.missingFiles > 0) {
    logger.warn('backup_photo_file_missing', { count: warnings.missingFiles });
  }
}
