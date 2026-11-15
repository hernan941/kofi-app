import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { ScrollView, Text, View } from 'react-native';

import { useAnnounceWhen } from './announce';
import { Icon } from './icon';
import { SecondaryButton } from './secondary-button';
import { StyledSafeAreaView } from './styled-safe-area-view';

/**
 * Why the app could not start (F0.10). It mirrors the `failed` reasons of the boot state
 * machine in `core/providers`, which cannot be imported from `shared`.
 */
export type BootFailureReason = 'migration_failed' | 'foreign_key_violation' | 'newer_database';

/** State of the emergency export (F8.8); `failed` carries the message to show. */
export type EmergencyExportStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working' }
  | { readonly kind: 'done' }
  | { readonly kind: 'failed'; readonly message: string };

/** The emergency export action: its state and what runs when the person presses the button. */
export interface EmergencyExport {
  readonly status: EmergencyExportStatus;
  readonly onPress: () => void;
}

/** Props of {@link BootErrorScreen}. */
export interface BootErrorScreenProps {
  readonly reason: BootFailureReason;
  readonly emergencyExport?: EmergencyExport;
}

const EMERGENCY_INTRO =
  'Puedes guardar una copia de tus datos y fotos tal como están ahora, para tenerlos a salvo.';
const EMERGENCY_BUTTON = 'Guardar una copia de mis datos';
const EMERGENCY_HINT = 'Crea un archivo con tus datos para guardarlo fuera de la app';
const EMERGENCY_WORKING = 'Preparando la copia…';
const EMERGENCY_DONE =
  'Copia lista. Guárdala en tu correo o en Drive. Esta copia sirve para rescatar tus datos, pero no se puede restaurar desde la app.';

interface BootErrorCopy {
  readonly title: string;
  readonly body: string;
  readonly reassurance: string;
}

const DATA_ERROR_COPY: BootErrorCopy = {
  title: 'No pudimos abrir tus datos',
  body: 'Algo falló al preparar la app. Cierra la app y vuelve a abrirla.',
  reassurance:
    'Si sigue pasando, no desinstales la app: así tus datos se quedan guardados en el teléfono.',
};

const COPY: Readonly<Record<BootFailureReason, BootErrorCopy>> = {
  migration_failed: DATA_ERROR_COPY,
  foreign_key_violation: DATA_ERROR_COPY,
  newer_database: {
    title: 'Actualiza la app',
    body: 'Necesitas una versión más nueva de la app para abrir tus datos.',
    reassurance: 'No cambiamos nada en tus datos.',
  },
};

function emergencyMessage(status: EmergencyExportStatus): string | undefined {
  switch (status.kind) {
    case 'working':
      return EMERGENCY_WORKING;
    case 'done':
      return EMERGENCY_DONE;
    case 'failed':
      return status.message;
    case 'idle':
      return undefined;
  }
}

function EmergencyExportSection({
  emergencyExport,
}: {
  readonly emergencyExport: EmergencyExport;
}) {
  const { status, onPress } = emergencyExport;
  const message = emergencyMessage(status);
  useAnnounceWhen(message);
  return (
    <View className="gap-3">
      <Text className="text-base text-foreground">{EMERGENCY_INTRO}</Text>
      <SecondaryButton
        label={EMERGENCY_BUTTON}
        accessibilityHint={EMERGENCY_HINT}
        isDisabled={status.kind === 'working'}
        onPress={onPress}
      />
      {status.kind === 'working' ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={EMERGENCY_WORKING}
          accessibilityState={{ busy: true }}
        >
          <Text className="text-base text-foreground">{EMERGENCY_WORKING}</Text>
        </View>
      ) : null}
      {status.kind === 'done' || status.kind === 'failed' ? (
        <View className="flex-row items-start gap-2">
          <Icon
            icon={status.kind === 'done' ? CheckCircleIcon : WarningCircleIcon}
            size="md"
            color={status.kind === 'done' ? 'accent' : 'danger'}
          />
          <Text className="flex-1 text-sm text-foreground">{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Screen shown when the boot fails (F0.10): it explains what happened and what to do, and
 * offers no action that writes data. When the emergency export of F8.8 is connected
 * through `emergencyExport`, its button is the only action.
 */
export function BootErrorScreen({ reason, emergencyExport }: BootErrorScreenProps) {
  const copy = COPY[reason];
  return (
    <StyledSafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-4 pt-12 pb-8">
        <Icon icon={WarningCircleIcon} size="xl" color="danger" />
        <View className="gap-3">
          <Text accessibilityRole="header" className="font-semibold text-title text-foreground">
            {copy.title}
          </Text>
          <Text className="text-base text-foreground">{copy.body}</Text>
          <Text className="text-base text-muted">{copy.reassurance}</Text>
        </View>
        {emergencyExport === undefined ? null : (
          <EmergencyExportSection emergencyExport={emergencyExport} />
        )}
      </ScrollView>
    </StyledSafeAreaView>
  );
}
