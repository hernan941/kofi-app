import { useCallback, useRef, useState } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { ExportProblem } from '../domain/errors';
import type { ExportProgress } from '../domain/progress';
import { exportBackup } from '../use-cases/export-backup';

/** Estado de "Crear respaldo". */
export type ExportBackupState =
  | { readonly status: 'idle' }
  | { readonly status: 'working'; readonly progress: ExportProgress }
  | { readonly status: 'done' }
  | { readonly status: 'failed'; readonly problem: ExportProblem };

/** Lo que devuelve {@link useExportBackup}. */
export interface ExportBackupController {
  readonly state: ExportBackupState;
  /** Crea el respaldo y abre el menú de compartir; no hace nada si ya está trabajando. */
  readonly run: () => Promise<void>;
  /** Vuelve a `idle` (por ejemplo, al tocar otra acción). No hace nada mientras está trabajando: la exportación en curso sigue su camino. */
  readonly reset: () => void;
}

/**
 * Estado de "Crear respaldo" (F8.1, 3.2): `idle → working(fase) → done | failed`. Un problema
 * esperable llega con su código; una excepción se registra y se muestra como inesperada. `done`
 * significa que el menú de compartir se cerró, se haya guardado o no el archivo.
 */
export function useExportBackup(): ExportBackupController {
  const dependencies = useDependencies();
  const [state, setState] = useState<ExportBackupState>({ status: 'idle' });
  const isRunning = useRef(false);

  const run = useCallback(async () => {
    if (isRunning.current) {
      return;
    }
    isRunning.current = true;
    setState({ status: 'working', progress: { phase: 'reading' } });
    try {
      const result = await exportBackup(
        {
          store: dependencies.backupStore,
          photos: dependencies.photos,
          archiveIo: dependencies.archiveIo,
          clock: dependencies.clock,
          logger: dependencies.logger,
          appVersion: dependencies.appVersion,
          calendar: dependencies.calendar,
          fileLock: dependencies.fileLock,
          backupFiles: dependencies.backupFiles,
          fileSharer: dependencies.fileSharer,
        },
        (progress) => {
          setState({ status: 'working', progress });
        },
      );
      setState(result.ok ? { status: 'done' } : { status: 'failed', problem: result.error });
    } catch (error) {
      dependencies.logger.error('backup_export_failed', error);
      setState({ status: 'failed', problem: 'unexpected' });
    } finally {
      isRunning.current = false;
    }
  }, [dependencies]);

  const reset = useCallback(() => {
    if (isRunning.current) {
      return;
    }
    setState({ status: 'idle' });
  }, []);

  return { state, run, reset };
}
