import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { SafetyBackupInfo } from '../domain/ports';
import { backupKeys } from './query-keys';

/**
 * Copia de seguridad más nueva (D-22), o `null` si no hay. Se vuelve a leer solo cuando algo
 * invalida `backupKeys.latestSafety()`: al terminar una restauración, que es lo único que
 * cambia la carpeta `safety/`.
 */
export function useLatestSafetyBackup(): UseQueryResult<SafetyBackupInfo | null> {
  const { backupFiles } = useDependencies();
  return useQuery({
    queryKey: backupKeys.latestSafety(),
    queryFn: () => backupFiles.latestSafety(),
  });
}
