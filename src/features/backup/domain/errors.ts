import type { ZipFormatError } from './zip/format';

/**
 * ADR-012, más `emergency_backup`: el archivo es una copia de emergencia (ADR-006), que la app
 * no restaura. `current_data_too_large`: los datos actuales superan `BACKUP_ZIP_LIMITS` y no caben en
 * su copia de seguridad. `invalid_data.issues` lleva rutas como `saleItems.12.quantity` (máx. 20).
 */
export type RestoreError =
  | { readonly code: 'not_a_backup' }
  | { readonly code: 'emergency_backup' }
  | { readonly code: 'invalid_archive'; readonly reason: ZipFormatError }
  | { readonly code: 'newer_format'; readonly formatVersion: number }
  | { readonly code: 'entries_mismatch' }
  | { readonly code: 'checksum_mismatch'; readonly path: string }
  | { readonly code: 'invalid_data'; readonly issues: readonly string[] }
  | { readonly code: 'broken_references' }
  | { readonly code: 'photo_conflict'; readonly photoId: string }
  | { readonly code: 'not_enough_space'; readonly requiredBytes: number }
  | { readonly code: 'current_data_too_large' };

/**
 * Errores esperables al exportar un respaldo o un CSV; `too_large` es que supera
 * `BACKUP_ZIP_LIMITS` e `inconsistent_data` que los datos actuales no pasan el esquema ni la
 * integridad del formato (no se escribe un respaldo que la app no podría restaurar).
 */
export type ExportError =
  | { readonly code: 'not_enough_space'; readonly requiredBytes: number }
  | { readonly code: 'too_large' }
  | { readonly code: 'inconsistent_data' }
  | { readonly code: 'sharing_unavailable' };

/** Errores esperables de la exportación de emergencia. */
export type EmergencyExportError =
  | { readonly code: 'not_enough_space'; readonly requiredBytes: number }
  | { readonly code: 'sharing_unavailable' }
  | { readonly code: 'database_unavailable' };

/** Problema al restaurar: uno esperable o una falla inesperada (la promesa rechazó). */
export type RestoreProblem = RestoreError | 'unexpected';

/** Problema al crear un respaldo o una planilla: uno esperable o una falla inesperada. */
export type ExportProblem = ExportError | 'unexpected';

/** Por qué falló el arranque de la app; coincide con los `kind` de `BootFailure` de `core/db`. */
export type EmergencyExportReason = 'migration_failed' | 'foreign_key_violation' | 'newer_database';
