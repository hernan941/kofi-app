import type { PhotoStorage } from '@/features/products';
import {
  epochMsSchema,
  err,
  ok,
  type EpochMs,
  type ProductPhotoId,
  type Result,
} from '@/shared/domain';
import type { Clock } from '@/shared/domain/calendar/clock';
import type { FileLock } from '@/shared/domain/file-lock';
import type { Logger } from '@/shared/lib/logger';

import type { BackupStore } from '../data/backup-store';
import type { RestoreError } from '../domain/errors';
import { isEmergencyArchive } from '../domain/format/emergency-archive';
import { photoIdFromEntryPath } from '../domain/format/contents';
import { checkIntegrity, checkPhotoFiles } from '../domain/format/integrity';
import {
  backupManifestV1Schema,
  BACKUP_FORMAT,
  SUPPORTED_FORMAT_VERSION,
  manifestEnvelopeSchema,
  type BackupManifestV1,
} from '../domain/format/manifest';
import { backupDataToSnapshot } from '../domain/format/mapping';
import { readBackupData } from '../domain/format/read-backup-data';
import type { ArchiveIo, BackupFiles, RandomAccessFile } from '../domain/ports';
import type { DatabaseSnapshot } from '../domain/snapshot';
import { decodeUtf8Strict } from '../domain/utf8';
import { openStoredArchive, readVerifiedEntry, type StoredArchive } from '../domain/zip/archive';
import type { ZipLimits } from '../domain/zip/format';

const MANIFEST = 'manifest.json';
const DATA = 'data.json';
const MAX_ISSUES = 20;
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const;
const NOT_A_BACKUP: Result<never, RestoreError> = err({ code: 'not_a_backup' });

/** Dependencias de {@link prepareRestore} y {@link confirmRestore}. */
export interface RestoreDeps {
  readonly archiveIo: ArchiveIo;
  readonly backupFiles: BackupFiles;
  readonly store: BackupStore;
  readonly photos: Pick<
    PhotoStorage,
    'listFiles' | 'uriFor' | 'partialUriFor' | 'promotePartial' | 'removePartial'
  >;
  readonly fileLock: FileLock;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly appVersion: string;
  readonly limits: ZipLimits;
  /** Deja que la UI pinte la fase `applying` antes del bloque síncrono del commit. */
  readonly yieldToUi: () => Promise<void>;
}

/** Conteos de lo que hay (o trae) en cada lado de la restauración. */
export interface RestoreCounts {
  readonly products: number;
  readonly saleRecords: number;
  readonly activePhotos: number;
}

/**
 * Vista previa (F8.1, D-45): los conteos del manifiesto, ya verificados contra los datos, y los
 * de lo que hay hoy en la app.
 */
export interface RestorePreview extends RestoreCounts {
  readonly createdAt: EpochMs;
  readonly current: RestoreCounts;
}

/** Una foto del respaldo, con dónde está dentro del ZIP. */
export interface RestorePhoto {
  readonly id: ProductPhotoId;
  readonly dataOffset: number;
  readonly size: number;
  readonly sha256: string;
}

/** Lo validado por `prepareRestore`, listo para confirmar. No mantiene archivos abiertos. */
export interface RestorePlan {
  readonly sourceUri: string;
  readonly archiveSize: number;
  readonly preview: RestorePreview;
  readonly snapshot: DatabaseSnapshot;
  readonly photos: readonly RestorePhoto[];
}

function startsWithZipSignature(bytes: Uint8Array): boolean {
  return ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function decodeJson(bytes: Uint8Array): unknown {
  const text = decodeUtf8Strict(bytes);
  if (!text.ok) {
    return undefined;
  }
  try {
    return JSON.parse(text.value) as unknown;
  } catch {
    return undefined;
  }
}

async function readManifest(
  file: RandomAccessFile,
  archive: StoredArchive,
): Promise<Result<BackupManifestV1, RestoreError>> {
  const entry = archive.entries.get(MANIFEST);
  if (entry === undefined) {
    return NOT_A_BACKUP;
  }
  const bytes = await readVerifiedEntry(file, entry);
  if (!bytes.ok) {
    return bytes;
  }
  const json = decodeJson(bytes.value);
  const envelope = manifestEnvelopeSchema.safeParse(json);
  if (!envelope.success || envelope.data.format !== BACKUP_FORMAT) {
    return NOT_A_BACKUP;
  }
  if (envelope.data.formatVersion > SUPPORTED_FORMAT_VERSION) {
    return err({ code: 'newer_format', formatVersion: envelope.data.formatVersion });
  }
  const manifest = backupManifestV1Schema.safeParse(json);
  if (!manifest.success) {
    const issues = manifest.error.issues
      .slice(0, MAX_ISSUES)
      .map((issue) => ['manifest', ...issue.path].join('.'));
    return err({ code: 'invalid_data', issues });
  }
  return ok(manifest.data);
}

function entriesMatchManifest(archive: StoredArchive, manifest: BackupManifestV1): boolean {
  const listed = new Map(manifest.files.map((file) => [file.path, file.byteSize]));
  if (listed.size !== manifest.files.length || listed.has(MANIFEST) || !listed.has(DATA)) {
    return false;
  }
  if (archive.entries.size !== listed.size + 1) {
    return false;
  }
  return [...listed].every(([path, size]) => archive.entries.get(path)?.size === size);
}

async function readData(
  file: RandomAccessFile,
  archive: StoredArchive,
  manifest: BackupManifestV1,
  io: ArchiveIo,
): Promise<Result<ReturnType<typeof backupDataToSnapshot>, RestoreError>> {
  const entry = archive.entries.get(DATA);
  const expected = manifest.files.find((candidate) => candidate.path === DATA);
  if (entry === undefined || expected === undefined) {
    return err({ code: 'entries_mismatch' });
  }
  const bytes = await readVerifiedEntry(file, entry);
  if (!bytes.ok) {
    return bytes;
  }
  if ((await io.sha256OfBytes(bytes.value)) !== expected.sha256) {
    return err({ code: 'checksum_mismatch', path: DATA });
  }
  const json = decodeJson(bytes.value);
  if (json === undefined) {
    return err({ code: 'invalid_data', issues: [DATA] });
  }
  const data = readBackupData(manifest.formatVersion, json);
  if (!data.ok) {
    return data;
  }
  const integrity = checkIntegrity(data.value, manifest);
  if (!integrity.ok) {
    return integrity;
  }
  const photoFiles = checkPhotoFiles(data.value, manifest);
  if (!photoFiles.ok) {
    return photoFiles;
  }
  return ok(backupDataToSnapshot(data.value));
}

function planPhotos(archive: StoredArchive, manifest: BackupManifestV1): RestorePhoto[] {
  return manifest.files.flatMap((file) => {
    const id = photoIdFromEntryPath(file.path);
    const entry = archive.entries.get(file.path);
    return id === null || entry === undefined
      ? []
      : [{ id, dataOffset: entry.dataOffset, size: entry.size, sha256: file.sha256 }];
  });
}

async function validate(
  deps: RestoreDeps,
  file: RandomAccessFile,
  sourceUri: string,
): Promise<Result<RestorePlan, RestoreError>> {
  if (file.size > deps.limits.maxArchiveBytes) {
    return err({ code: 'invalid_archive', reason: 'too_large' });
  }
  if (file.size < ZIP_SIGNATURE.length) {
    return NOT_A_BACKUP;
  }
  if (!startsWithZipSignature(await file.read(0, ZIP_SIGNATURE.length))) {
    return NOT_A_BACKUP;
  }
  if (await isEmergencyArchive(file)) {
    return err({ code: 'emergency_backup' });
  }
  const opened = await openStoredArchive(file, deps.limits);
  if (!opened.ok) {
    return opened.error === 'not_a_zip'
      ? NOT_A_BACKUP
      : err({ code: 'invalid_archive', reason: opened.error });
  }
  const manifest = await readManifest(file, opened.value);
  if (!manifest.ok) {
    return manifest;
  }
  if (!entriesMatchManifest(opened.value, manifest.value)) {
    return err({ code: 'entries_mismatch' });
  }
  const snapshot = await readData(file, opened.value, manifest.value, deps.archiveIo);
  if (!snapshot.ok) {
    return snapshot;
  }
  const current = await deps.store.countActive();
  return ok({
    sourceUri,
    archiveSize: file.size,
    preview: {
      createdAt: epochMsSchema.parse(Date.parse(manifest.value.createdAt)),
      ...manifest.value.counts,
      current,
    },
    snapshot: snapshot.value,
    photos: planPhotos(opened.value, manifest.value),
  });
}

/**
 * Pasos 1 a 4 de ADR-012: valida por contenido (`PK\x03\x04`, no por tipo MIME), la estructura
 * del ZIP, el manifiesto, que las entradas sean exactamente `manifest.json` más `manifest.files`,
 * el CRC32 y el `sha256` de `data.json`, su esquema y su integridad referencial. Devuelve el plan
 * con la vista previa (con los conteos de lo que hay hoy en la app, D-45, que cuenta con SQL sin
 * leer el snapshot completo). No escribe nada y
 * cierra el archivo al terminar, también si falla. Las fotos se verifican al copiarlas.
 */
export async function prepareRestore(
  deps: RestoreDeps,
  sourceUri: string,
): Promise<Result<RestorePlan, RestoreError>> {
  const file = await deps.archiveIo.openForRead(sourceUri);
  try {
    return await validate(deps, file, sourceUri);
  } finally {
    file.close();
  }
}
