export { escapeCsvCell, serializeCsv } from './csv/csv-writer';
export { buildProductsCsv } from './csv/products-csv';
export { buildSalesCsv } from './csv/sales-csv';
export type {
  EmergencyExportError,
  EmergencyExportReason,
  ExportError,
  RestoreError,
} from './errors';
export {
  backupDataV1Schema,
  type BackupDataV1,
  type BackupNoSalesWeekV1,
  type BackupProductPhotoV1,
  type BackupProductV1,
  type BackupProductVersionV1,
  type BackupSaleItemV1,
  type BackupSaleRecordV1,
  type BackupTipViewV1,
} from './format/backup-data-v1';
export {
  buildManifest,
  encodeJson,
  photoEntryPath,
  photoIdFromEntryPath,
  type ManifestInput,
} from './format/contents';
export { checkIntegrity, checkPhotoFiles } from './format/integrity';
export {
  BACKUP_FORMAT,
  SUPPORTED_FORMAT_VERSION,
  backupManifestV1Schema,
  manifestEnvelopeSchema,
  type BackupManifestV1,
} from './format/manifest';
export { backupDataToSnapshot, snapshotToBackupData } from './format/mapping';
export { readBackupData } from './format/read-backup-data';
export type {
  ArchiveIo,
  BackupFiles,
  CopiedDatabaseFile,
  DatabaseCopier,
  DocumentPicker,
  FileSharer,
  PickedDocument,
  RandomAccessFile,
  SafetyBackupInfo,
  SafetyTarget,
  SequentialWriter,
} from './ports';
export type { ExportProgress } from './progress';
export {
  PRODUCTS_CSV_FILE_NAME,
  SALES_CSV_FILE_NAME,
  backupFileName,
  emergencyFileName,
  isExportFileName,
  parseSafetyFileName,
  safetyFileName,
} from './file-names';
export {
  FREE_SPACE_MARGIN_BYTES,
  estimateArchiveBytes,
  requiredBytesForExport,
  requiredBytesForRestore,
} from './space';
export { SNAPSHOT_COLUMNS } from './snapshot';
export type {
  DatabaseSnapshot,
  SnapshotNoSalesWeekRow,
  SnapshotProductPhotoRow,
  SnapshotProductRow,
  SnapshotProductVersionRow,
  SnapshotSaleItemRow,
  SnapshotSaleRecordRow,
  SnapshotTable,
  SnapshotTipViewRow,
} from './snapshot';
export { decodeUtf8Strict, encodeUtf8 } from './utf8';
export {
  ZipWriteError,
  openStoredArchive,
  readVerifiedEntry,
  writeStoredArchive,
  type ArchiveEntryInput,
  type StoredArchive,
} from './zip/archive';
export { crc32 } from './zip/crc32';
export { isBackupEntryName, isSafeEntryName } from './zip/entry-names';
export {
  BACKUP_ZIP_LIMITS,
  type ZipEntry,
  type ZipFormatError,
  type ZipLimits,
} from './zip/format';
