import { err, ok, type Result } from '@/shared/domain';

import type { RestoreError } from '../errors';
import { backupDataV1Schema, type BackupDataV1 } from './backup-data-v1';
import { SUPPORTED_FORMAT_VERSION } from './manifest';

const MAX_ISSUES = 20;

/**
 * Valida `data.json` ya decodificado según la versión del manifiesto. Hoy solo v1; una versión
 * nueva agrega su esquema y una función `upgradeV1ToV2` pura encadenada aquí.
 */
export function readBackupData(
  formatVersion: number,
  json: unknown,
): Result<BackupDataV1, RestoreError> {
  if (formatVersion > SUPPORTED_FORMAT_VERSION) {
    return err({ code: 'newer_format', formatVersion });
  }
  if (formatVersion !== SUPPORTED_FORMAT_VERSION) {
    return err({ code: 'not_a_backup' });
  }
  const parsed = backupDataV1Schema.safeParse(json);
  if (parsed.success) {
    return ok(parsed.data);
  }
  const issues = parsed.error.issues.slice(0, MAX_ISSUES).map((issue) => issue.path.join('.'));
  return err({ code: 'invalid_data', issues });
}
