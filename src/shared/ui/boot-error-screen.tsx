import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from './icon';
import { SecondaryButton } from './secondary-button';

/**
 * Why the app could not start (F0.10). It mirrors the `failed` reasons of the boot state
 * machine in `core/providers`, which cannot be imported from `shared`.
 */
export type BootFailureReason = 'migration_failed' | 'foreign_key_violation' | 'newer_database';

/** Props of {@link BootErrorScreen}. */
export interface BootErrorScreenProps {
  readonly reason: BootFailureReason;
  readonly onEmergencyExport?: () => void;
}

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

/**
 * Screen shown when the boot fails (F0.10): it explains what happened and what to do, and
 * offers no action that writes data. When the emergency export of F8.8 is connected
 * through `onEmergencyExport`, its button is the only action.
 */
export function BootErrorScreen({ reason, onEmergencyExport }: BootErrorScreenProps) {
  const copy = COPY[reason];
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-6 px-4 pt-12 pb-8">
        <Icon icon={WarningCircleIcon} size="xl" color="danger" />
        <View className="gap-3">
          <Text accessibilityRole="header" className="font-semibold text-title text-foreground">
            {copy.title}
          </Text>
          <Text className="text-base text-foreground">{copy.body}</Text>
          <Text className="text-base text-muted">{copy.reassurance}</Text>
        </View>
        {onEmergencyExport === undefined ? null : (
          <SecondaryButton label="Guardar una copia de mis datos" onPress={onEmergencyExport} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
