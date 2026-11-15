import { Text, View } from 'react-native';

import {
  ClockCounterClockwiseIcon,
  ExportIcon,
  InlineNotice,
  ListSeparator,
  PrimaryButton,
  ProgressBlock,
  SecondaryButton,
  announce,
  useAnnounceWhen,
} from '@/shared/ui';

import { backupDateOf, type BackupDate } from '../domain/backup-date';
import type { RestoreSource } from '../hooks/restore-flow';
import type { ExportBackupState } from '../hooks/use-export-backup';
import type { CsvKind, ExportCsvState } from '../hooks/use-export-csv';
import { BLOCKED_MESSAGE, exportProblemMessage, exportProgressView } from './backup-messages';

/** Props of {@link BackupActions}. */
export interface BackupActionsProps {
  readonly backup: ExportBackupState;
  readonly csv: ExportCsvState;
  /** Qué se está revisando antes de la vista previa, si algo. */
  readonly inspecting: RestoreSource | null;
  /** Fecha de la copia de seguridad; `null` si no hay y la sección no aparece. */
  readonly safetyDate: BackupDate | null;
  readonly onCreateBackup: () => void;
  readonly onExportCsv: (kind: CsvKind) => void;
  readonly onPickFile: () => void;
  readonly onRestoreSafety: () => void;
}

const CSV_PROGRESS_LABELS: Readonly<Record<CsvKind, string>> = {
  sales: 'Preparando la planilla de ventas…',
  products: 'Preparando la planilla de productos…',
};

function Section({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="font-semibold text-heading text-foreground">
        {title}
      </Text>
      <Text className="text-base text-muted">{description}</Text>
      {children}
    </View>
  );
}

function announceBlocked(): void {
  announce(BLOCKED_MESSAGE);
}

/**
 * `PrimaryButton` no se puede deshabilitar (sistema de diseño): mientras otra acción trabaja,
 * tocarlo no inicia nada y anuncia que hay que esperar.
 */
function CreateBackupSection({
  state,
  isBusy,
  onCreate,
}: {
  readonly state: ExportBackupState;
  readonly isBusy: boolean;
  readonly onCreate: () => void;
}) {
  const view = state.status === 'working' ? exportProgressView(state.progress) : null;
  useAnnounceWhen(view?.announcement);
  return (
    <Section
      title="Respaldo de tus datos"
      description="Guarda en un archivo todo lo que tienes en la app: productos, fotos y ventas. Guárdalo en tu correo, en Drive o donde prefieras."
    >
      {view === null ? (
        <PrimaryButton
          label="Crear respaldo"
          icon={ExportIcon}
          onPress={isBusy ? announceBlocked : onCreate}
        />
      ) : (
        <ProgressBlock label={view.label} progress={view.progress} />
      )}
      {state.status === 'failed' ? (
        <InlineNotice tone="danger" message={exportProblemMessage(state.problem, 'backup')} />
      ) : null}
      <InlineNotice message="El archivo no lleva contraseña. Guárdalo en un lugar que solo uses tú." />
    </Section>
  );
}

function SheetButton({
  kind,
  label,
  state,
  isBusy,
  onPress,
}: {
  readonly kind: CsvKind;
  readonly label: string;
  readonly state: ExportCsvState;
  readonly isBusy: boolean;
  readonly onPress: (kind: CsvKind) => void;
}) {
  if (state.status === 'working' && state.kind === kind) {
    return <ProgressBlock label={CSV_PROGRESS_LABELS[kind]} />;
  }
  return (
    <SecondaryButton
      label={label}
      icon={ExportIcon}
      isDisabled={isBusy}
      onPress={() => {
        onPress(kind);
      }}
    />
  );
}

function SheetsSection({
  state,
  isBusy,
  onExport,
}: {
  readonly state: ExportCsvState;
  readonly isBusy: boolean;
  readonly onExport: (kind: CsvKind) => void;
}) {
  useAnnounceWhen(state.status === 'working' ? CSV_PROGRESS_LABELS[state.kind] : undefined);
  return (
    <Section
      title="Ventas y productos en planillas"
      description="Crea archivos para abrir en Excel o Google Sheets. Sirven para mirar tus datos, no para restaurarlos."
    >
      <SheetButton
        kind="sales"
        label="Exportar ventas"
        state={state}
        isBusy={isBusy}
        onPress={onExport}
      />
      <SheetButton
        kind="products"
        label="Exportar productos"
        state={state}
        isBusy={isBusy}
        onPress={onExport}
      />
      {state.status === 'failed' ? (
        <InlineNotice tone="danger" message={exportProblemMessage(state.problem, 'sheet')} />
      ) : null}
    </Section>
  );
}

/**
 * Secciones de la pantalla "Respaldo" (F8.1, 3.1): crear respaldo, exportar planillas,
 * restaurar y, si existe, la copia de seguridad. Sin tarjetas: título, frase y botón. Mientras
 * algo trabaja, su botón se cambia por el progreso en la misma sección y las demás acciones
 * quedan deshabilitadas. Los problemas de crear y exportar se muestran en su sección.
 */
export function BackupActions({
  backup,
  csv,
  inspecting,
  safetyDate,
  onCreateBackup,
  onExportCsv,
  onPickFile,
  onRestoreSafety,
}: BackupActionsProps) {
  const isBusy = backup.status === 'working' || csv.status === 'working' || inspecting !== null;
  return (
    <View className="gap-8">
      <CreateBackupSection state={backup} isBusy={isBusy} onCreate={onCreateBackup} />
      <ListSeparator />
      <SheetsSection state={csv} isBusy={isBusy} onExport={onExportCsv} />
      <ListSeparator />
      <Section
        title="Restaurar un respaldo"
        description="Cambia todo lo que hay en la app por lo que tiene un respaldo que creaste antes. Primero vas a ver qué contiene."
      >
        {inspecting === 'file' ? (
          <ProgressBlock label="Revisando el archivo…" />
        ) : (
          <SecondaryButton
            label="Elegir un respaldo"
            icon={ClockCounterClockwiseIcon}
            isDisabled={isBusy}
            onPress={onPickFile}
          />
        )}
      </Section>
      {safetyDate === null ? null : (
        <>
          <ListSeparator />
          <Section
            title="Copia de seguridad"
            description="Es como estaba la app justo antes de tu última restauración. Guardamos solo la más reciente."
          >
            <Text className="text-base text-foreground">{`Copia ${backupDateOf(safetyDate)}`}</Text>
            {inspecting === 'safety' ? (
              <ProgressBlock label="Revisando la copia…" />
            ) : (
              <SecondaryButton
                label="Restaurar esta copia"
                icon={ClockCounterClockwiseIcon}
                isDisabled={isBusy}
                onPress={onRestoreSafety}
              />
            )}
          </Section>
        </>
      )}
    </View>
  );
}
