import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { RestoreProblem } from '../domain/errors';
import type { RestoreProgress } from '../domain/progress';
import { BACKUP_ZIP_LIMITS } from '../domain/zip/format';
import { confirmRestore } from '../use-cases/confirm-restore';
import { prepareRestore, type RestoreDeps, type RestorePlan } from '../use-cases/prepare-restore';
import { backupKeys } from './query-keys';
import { INITIAL_RESTORE_FLOW, restoreFlow, type RestoreFlowState } from './restore-flow';

/** Lo que devuelve {@link useRestoreBackup}. */
export interface RestoreBackupController {
  readonly state: RestoreFlowState;
  /** Abre el selector de archivos; cancelarlo no es un problema. */
  readonly pickFile: () => Promise<void>;
  /** Prepara la restauración de la copia de seguridad, copiándola antes a la caché. */
  readonly restoreSafety: () => Promise<void>;
  /** Restaura lo de la vista previa; `onProgress` recibe cada fase además del estado. */
  readonly confirm: (onProgress?: (progress: RestoreProgress) => void) => Promise<void>;
  /** Cancela la vista previa y descarta la copia del selector. */
  readonly cancel: () => void;
  /** Vuelve a la pantalla inicial desde un problema o desde el éxito. */
  readonly reset: () => void;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Estado de la restauración (F8.0, 4.8) sobre el reducer puro `restoreFlow`: elegir archivo (o
 * la copia de seguridad), revisarlo, mostrar la vista previa, restaurar con progreso y terminar
 * en éxito o problema. Una excepción se registra y se muestra como un problema inesperado.
 * Si la pantalla se cierra en la vista previa, descarta la copia del selector.
 *
 * `pickFile`, `restoreSafety` y `confirm` comparten una guarda síncrona: mientras una corre, las
 * otras (y un segundo toque) no hacen nada. Si la pantalla se cierra durante `inspecting`, la
 * revisión termina sin que nadie la use y la copia queda en `cache/DocumentPicker/` (la del
 * selector o la de la copia de seguridad) hasta que `cleanupBackupTemporaries` la barre, a los 15
 * minutos o en el próximo arranque.
 */
export function useRestoreBackup(): RestoreBackupController {
  const dependencies = useDependencies();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(restoreFlow, INITIAL_RESTORE_FLOW);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const isRunning = useRef(false);
  const { archiveIo, backupFiles, backupStore, documentPicker, logger } = dependencies;

  const runExclusive = useCallback(async (action: () => Promise<void>) => {
    if (isRunning.current) {
      return;
    }
    isRunning.current = true;
    try {
      await action();
    } finally {
      isRunning.current = false;
    }
  }, []);

  const deps = useCallback(
    (): RestoreDeps => ({
      archiveIo,
      backupFiles,
      store: backupStore,
      photos: dependencies.photos,
      fileLock: dependencies.fileLock,
      clock: dependencies.clock,
      logger,
      appVersion: dependencies.appVersion,
      limits: BACKUP_ZIP_LIMITS,
      yieldToUi,
    }),
    [archiveIo, backupFiles, backupStore, dependencies, logger],
  );

  useEffect(
    () => () => {
      const current = stateRef.current;
      if (current.status === 'preview') {
        backupFiles.discardPicked(current.plan.sourceUri);
      }
    },
    [backupFiles],
  );

  const inspect = useCallback(
    async (uri: string) => {
      try {
        const prepared = await prepareRestore(deps(), uri);
        if (prepared.ok) {
          dispatch({ type: 'inspected', plan: prepared.value });
          return;
        }
        backupFiles.discardPicked(uri);
        dispatch({ type: 'inspectFailed', problem: prepared.error });
      } catch (error) {
        logger.error('backup_prepare_failed', error);
        backupFiles.discardPicked(uri);
        dispatch({ type: 'inspectFailed', problem: 'unexpected' });
      }
    },
    [backupFiles, deps, logger],
  );

  const pickAndInspect = useCallback(async () => {
    dispatch({ type: 'pick' });
    let picked;
    try {
      picked = await documentPicker.pickSingle({ mimeTypes: ['*/*'] });
    } catch (error) {
      logger.error('backup_picker_failed', error);
      dispatch({ type: 'inspectFailed', problem: 'unexpected' });
      return;
    }
    if (picked === null) {
      dispatch({ type: 'pickCancelled' });
      return;
    }
    dispatch({ type: 'inspect', source: 'file' });
    await inspect(picked.uri);
  }, [documentPicker, inspect, logger]);

  const pickFile = useCallback(() => runExclusive(pickAndInspect), [pickAndInspect, runExclusive]);

  const inspectSafety = useCallback(async () => {
    const safety = backupFiles.latestSafety();
    if (safety === null) {
      return;
    }
    dispatch({ type: 'inspect', source: 'safety' });
    const copyUri = backupFiles.restoreCopyTarget();
    try {
      const source = await archiveIo.openForRead(safety.uri);
      try {
        await archiveIo.copyRange(source, 0, source.size, copyUri);
      } finally {
        source.close();
      }
    } catch (error) {
      logger.error('backup_safety_copy_failed', error);
      backupFiles.discardPicked(copyUri);
      dispatch({ type: 'inspectFailed', problem: 'unexpected' });
      return;
    }
    await inspect(copyUri);
  }, [archiveIo, backupFiles, inspect, logger]);

  const restoreSafety = useCallback(
    () => runExclusive(inspectSafety),
    [inspectSafety, runExclusive],
  );

  const runRestore = useCallback(
    async (onProgress?: (progress: RestoreProgress) => void) => {
      const current = stateRef.current;
      if (current.status !== 'preview') {
        return;
      }
      const plan: RestorePlan = current.plan;
      dispatch({ type: 'confirm' });
      try {
        const result = await confirmRestore(deps(), plan, (progress) => {
          dispatch({ type: 'progress', progress });
          onProgress?.(progress);
        });
        dispatch(
          result.ok ? { type: 'restored' } : { type: 'restoreFailed', problem: result.error },
        );
      } catch (error) {
        logger.error('backup_restore_failed', error);
        dispatch({ type: 'restoreFailed', problem: 'unexpected' satisfies RestoreProblem });
      } finally {
        void queryClient.invalidateQueries({ queryKey: backupKeys.latestSafety() });
      }
    },
    [deps, logger, queryClient],
  );

  const confirm = useCallback(
    (onProgress?: (progress: RestoreProgress) => void) =>
      runExclusive(() => runRestore(onProgress)),
    [runExclusive, runRestore],
  );

  const cancel = useCallback(() => {
    const current = stateRef.current;
    if (current.status === 'preview') {
      backupFiles.discardPicked(current.plan.sourceUri);
      dispatch({ type: 'discard' });
    }
  }, [backupFiles]);

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
  }, []);

  return { state, pickFile, restoreSafety, confirm, cancel, reset };
}
