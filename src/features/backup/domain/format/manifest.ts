import { z } from 'zod';

/** Única versión del formato que esta app sabe leer. */
export const SUPPORTED_FORMAT_VERSION = 1;
/** Valor de `format` de todo respaldo de la app. */
export const BACKUP_FORMAT = 'cuantovendi-backup';

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const countSchema = z.number().int().min(0);

/** Manifiesto v1 (ADR-012), *strict*. `createdAt` es ISO 8601 UTC, desde 1970 (un `EpochMs` no puede ser negativo). */
export const backupManifestV1Schema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.literal(SUPPORTED_FORMAT_VERSION),
  createdAt: z.iso.datetime().refine((value) => Date.parse(value) >= 0),
  appVersion: z.string().min(1).max(64),
  counts: z.strictObject({
    products: countSchema,
    saleRecords: countSchema,
    activePhotos: countSchema,
  }),
  files: z.array(
    z.strictObject({
      path: z.string().min(1).max(255),
      byteSize: countSchema,
      sha256: sha256Schema,
    }),
  ),
});

/** Manifiesto del respaldo; se lee y valida antes que cualquier otra entrada. */
export type BackupManifestV1 = z.infer<typeof backupManifestV1Schema>;

/**
 * Sobre laxo del manifiesto: permite decidir `not_a_backup` o `newer_format` antes de aplicar el
 * esquema *strict* de la versión.
 */
export const manifestEnvelopeSchema = z.object({
  format: z.string(),
  formatVersion: z.number().int(),
});
