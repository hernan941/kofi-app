import { useEffect, useRef } from 'react';
import { ScrollView } from 'react-native';

import { usePreventLeave } from '@/shared/lib/use-prevent-leave';
import { Screen, ScreenHeader, announce, useAppToast } from '@/shared/ui';

import { BackupActions } from '../components/backup-actions';
import { BLOCKED_MESSAGE } from '../components/backup-messages';
import { BackupProgress } from '../components/backup-progress';
import { RestoreFailure, RestoreSuccess } from '../components/restore-result';
import { RestorePreview } from '../components/restore-preview';
import type { RestoreFlowState } from '../hooks/restore-flow';
import type { BackupDate } from '../domain/backup-date';
import type { SafetyBackupInfo } from '../domain/ports';
import { useBackupDates, type BackupDates } from '../hooks/use-backup-dates';
import { useExportBackup } from '../hooks/use-export-backup';
import { useExportCsv, type CsvKind } from '../hooks/use-export-csv';
import { useLatestSafetyBackup } from '../hooks/use-latest-safety-backup';
import { useRestoreBackup } from '../hooks/use-restore-backup';

const CSV_DONE_MESSAGES: Readonly<Record<CsvKind, string>> = {
  sales: 'Planilla de ventas lista',
  products: 'Planilla de productos lista',
};

/** Props of {@link BackupScreen}. */
export interface BackupScreenProps {
  readonly onBack: () => void;
  /** Sale hasta Inicio vaciando la pila, para que volver no regrese al éxito. */
  readonly onGoHome: () => void;
}

function safetyDateOf(
  safety: SafetyBackupInfo | null,
  formatDate: BackupDates['formatDate'],
): BackupDate | null {
  return safety === null ? null : formatDate(safety.createdAt);
}

function inspectingSource(state: RestoreFlowState) {
  return state.status === 'inspecting' ? state.source : null;
}

/**
 * Pantalla "Respaldo" (F8.1): crear respaldo, exportar planillas, restaurar y la copia de
 * seguridad. La vista previa, el progreso, el éxito y los problemas de restaurar son estados de
 * esta misma pantalla. No se puede salir mientras algo trabaja (anuncia "Espera a que
 * termine."), y volver desde la vista previa equivale a "Cancelar".
 */
export function BackupScreen({ onBack, onGoHome }: BackupScreenProps) {
  const { formatDate } = useBackupDates();
  const safety = useLatestSafetyBackup().data ?? null;
  const toast = useAppToast();
  const backup = useExportBackup();
  const csv = useExportCsv();
  const restore = useRestoreBackup();
  const restoreState = restore.state;

  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  });
  const backupStatus = backup.state.status;
  useEffect(() => {
    if (backupStatus === 'done') {
      toastRef.current.showSuccess('Respaldo creado');
    }
  }, [backupStatus]);
  const csvDoneKind = csv.state.status === 'done' ? csv.state.kind : null;
  useEffect(() => {
    if (csvDoneKind !== null) {
      toastRef.current.showSuccess(CSV_DONE_MESSAGES[csvDoneKind]);
    }
  }, [csvDoneKind]);

  const isSharing = backup.state.status === 'working' && backup.state.progress.phase === 'sharing';
  const isBusy =
    (backup.state.status === 'working' && !isSharing) ||
    csv.state.status === 'working' ||
    restoreState.status === 'inspecting' ||
    restoreState.status === 'restoring' ||
    restoreState.status === 'picking';
  const isPreview = restoreState.status === 'preview';
  usePreventLeave(isBusy || isPreview, () => {
    if (isPreview) {
      restore.cancel();
    } else {
      announce(BLOCKED_MESSAGE);
    }
  });

  const clearNotices = () => {
    backup.reset();
    csv.reset();
  };

  if (restoreState.status === 'preview') {
    return (
      <Screen>
        <ScreenHeader title="Restaurar" onBack={restore.cancel} />
        <RestorePreview
          preview={restoreState.plan.preview}
          source={restoreState.source}
          date={formatDate(restoreState.plan.preview.createdAt)}
          previousSafetyDate={
            restoreState.source === 'file' ? safetyDateOf(safety, formatDate) : null
          }
          onConfirm={() => {
            void restore.confirm();
          }}
          onCancel={restore.cancel}
        />
      </Screen>
    );
  }
  if (restoreState.status === 'restoring') {
    return (
      <Screen>
        <ScreenHeader title="Restaurar" />
        <BackupProgress
          progress={restoreState.progress}
          hasPhotos={restoreState.plan.preview.activePhotos > 0}
          source={restoreState.source}
        />
      </Screen>
    );
  }
  if (restoreState.status === 'done') {
    return (
      <Screen>
        <ScreenHeader />
        <RestoreSuccess
          source={restoreState.source}
          date={formatDate(restoreState.preview.createdAt)}
          onGoHome={onGoHome}
        />
      </Screen>
    );
  }
  if (restoreState.status === 'failed') {
    return (
      <Screen>
        <ScreenHeader title="Restaurar" onBack={onBack} />
        <RestoreFailure
          problem={restoreState.problem}
          source={restoreState.source}
          afterConfirm={restoreState.afterConfirm}
          onBack={restore.reset}
          onPickAnother={() => {
            void restore.pickFile();
          }}
        />
      </Screen>
    );
  }
  return (
    <Screen>
      <ScreenHeader title="Respaldo" onBack={isBusy ? undefined : onBack} />
      <ScrollView contentContainerClassName="px-4 pt-4 pb-8">
        <BackupActions
          backup={backup.state}
          csv={csv.state}
          inspecting={inspectingSource(restoreState)}
          safetyDate={safetyDateOf(safety, formatDate)}
          onCreateBackup={() => {
            clearNotices();
            void backup.run();
          }}
          onExportCsv={(kind) => {
            clearNotices();
            void csv.run(kind);
          }}
          onPickFile={() => {
            clearNotices();
            void restore.pickFile();
          }}
          onRestoreSafety={() => {
            clearNotices();
            void restore.restoreSafety();
          }}
        />
      </ScrollView>
    </Screen>
  );
}
