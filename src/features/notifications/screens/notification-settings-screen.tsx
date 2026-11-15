import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
  Card,
  CaretRightIcon,
  ErrorState,
  Icon,
  InlineNotice,
  ListRow,
  ListSeparator,
  LoadingState,
  Screen,
  ScreenHeader,
  SwitchRow,
  announce,
  useAppToast,
} from '@/shared/ui';

import { formatReminderTime, weekdayPlural } from '../components/notification-texts';
import { PermissionStatus } from '../components/permission-status';
import { TestReminderPanel } from '../components/test-reminder-panel';
import { WeeklyReminderSheet } from '../components/weekly-reminder-sheet';
import type { WeeklyReminderValue } from '../components/weekly-reminder-fields';
import type { NotificationPreferences } from '../domain/preferences';
import type { NotificationPermission } from '../domain/ports';
import { useOpenSystemSettings } from '../hooks/use-open-system-settings';
import { useNotificationPermission } from '../hooks/use-notification-permission';
import { useNotificationPreferences } from '../hooks/use-notification-preferences';
import { useRequestNotificationPermission } from '../hooks/use-request-notification-permission';
import { useSaveNotificationPreferences } from '../hooks/use-save-notification-preferences';

const SAVE_ERROR = 'No se pudo guardar el cambio. Inténtalo de nuevo.';

/** Props of {@link NotificationSettingsScreen}. */
export interface NotificationSettingsScreenProps {
  readonly onBack: () => void;
}

/** Anuncia "Recordatorios activados" cuando el permiso pasa a concedido estando la pantalla abierta. */
function useAnnounceGranted(permission: NotificationPermission | undefined): void {
  const previous = useRef<NotificationPermission | undefined>(undefined);
  useEffect(() => {
    if (
      permission === 'granted' &&
      (previous.current === 'denied' || previous.current === 'undetermined')
    ) {
      announce('Recordatorios activados');
    }
    previous.current = permission;
  }, [permission]);
}

/** Fila de "Día y hora" con su subtítulo, que abre la hoja. */
function WeeklyTimeRow({
  weekly,
  onPress,
}: {
  readonly weekly: NotificationPreferences['weekly'];
  readonly onPress: () => void;
}) {
  const days = weekdayPlural(weekly.weekday, { capitalized: true });
  return (
    <ListRow
      title="Día y hora"
      subtitle={`${days} a las ${formatReminderTime(weekly.minuteOfDay)}`}
      accessibilityHint="Cambia cuándo llega el recordatorio"
      onPress={onPress}
      trailing={<Icon icon={CaretRightIcon} color="muted" />}
    />
  );
}

/**
 * Recordatorios (F7.1, 3.2): estado del permiso, interruptores del semanal y del resumen del
 * mes, y la hoja de día y hora. Las preferencias se pueden cambiar aunque el permiso no esté
 * concedido (D-43). Guardar emite `DataChanges`, que reconcilia: aquí no se hace nada más. Un interruptor no
 * anuncia el éxito (el lector ya dice su estado); solo se avisa si falla.
 */
export function NotificationSettingsScreen({ onBack }: NotificationSettingsScreenProps) {
  const toast = useAppToast();
  const preferences = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const { permission } = useNotificationPermission();
  const { request } = useRequestNotificationPermission();
  const openSystemSettings = useOpenSystemSettings();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  useAnnounceGranted(permission);

  const shown = save.isPending ? save.variables : preferences.data;

  const change = (next: NotificationPreferences) => {
    save.mutate(next, {
      onError: () => {
        toast.showError(SAVE_ERROR);
      },
    });
  };

  const saveWeeklyTime = async (value: WeeklyReminderValue) => {
    if (shown === undefined) {
      return;
    }
    try {
      await save.mutateAsync({ ...shown, weekly: { ...shown.weekly, ...value } });
      setIsSheetOpen(false);
      toast.showSuccess(
        `Listo, te avisamos ${weekdayPlural(value.weekday)} a las ${formatReminderTime(value.minuteOfDay)}.`,
      );
    } catch {
      toast.showError(SAVE_ERROR);
    }
  };

  if (preferences.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Recordatorios" onBack={onBack} />
        <LoadingState label="Cargando tus recordatorios" shape="rows" count={3} />
      </Screen>
    );
  }
  if (shown === undefined) {
    return (
      <Screen>
        <ScreenHeader title="Recordatorios" onBack={onBack} />
        <ErrorState
          message="No se pudieron cargar tus recordatorios."
          onRetry={() => {
            void preferences.refetch();
          }}
        />
      </Screen>
    );
  }

  const isPermissionMissing = permission === 'undetermined' || permission === 'denied';
  return (
    <Screen>
      <ScreenHeader title="Recordatorios" onBack={onBack} />
      <ScrollView contentContainerClassName="gap-6 px-4 pt-4 pb-8">
        <PermissionStatus
          permission={permission}
          onRequest={() => {
            void request();
          }}
          onOpenSettings={openSystemSettings}
        />
        <Card>
          <View className="-mx-4">
            <SwitchRow
              title="Recordatorio semanal"
              description="Un aviso por semana para anotar tus ventas."
              value={shown.weekly.enabled}
              onChange={(enabled) => {
                change({ ...shown, weekly: { ...shown.weekly, enabled } });
              }}
            />
            {shown.weekly.enabled ? (
              <>
                <ListSeparator />
                <View className="px-4">
                  <WeeklyTimeRow
                    weekly={shown.weekly}
                    onPress={() => {
                      setIsSheetOpen(true);
                    }}
                  />
                </View>
              </>
            ) : null}
            <ListSeparator />
            <SwitchRow
              title="Resumen del mes"
              description="El día 1 a las 10:00, te avisamos que está listo el resumen del mes anterior."
              value={shown.monthly.enabled}
              onChange={(enabled) => {
                change({ ...shown, monthly: { enabled } });
              }}
            />
          </View>
        </Card>
        <Text className="text-sm text-muted">
          Si pasas un tiempo sin abrir la app, el recordatorio sigue llegando con un mensaje
          general. Nunca recibes más de uno por semana.
        </Text>
        {isPermissionMissing ? (
          <InlineNotice message="Lo que elijas aquí se guarda y empieza a funcionar cuando actives los avisos." />
        ) : null}
        {__DEV__ || process.env.EXPO_PUBLIC_E2E === '1' ? <TestReminderPanel /> : null}
      </ScrollView>
      <WeeklyReminderSheet
        isOpen={isSheetOpen}
        weekly={shown.weekly}
        onSave={(value) => {
          void saveWeeklyTime(value);
        }}
        onClose={() => {
          setIsSheetOpen(false);
        }}
      />
    </Screen>
  );
}
