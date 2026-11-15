import { useEffect, useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';

import {
  BellIcon,
  CalendarBlankIcon,
  GearIcon,
  Icon,
  PrimaryButton,
  Screen,
  TextButton,
  useAppToast,
  type IconProps,
  StyledSafeAreaView,
} from '@/shared/ui';
import { useScheduleFrame } from '@/shared/lib/use-schedule-frame';

import { formatReminderTime, weekdayPlural } from '../components/notification-texts';
import { useNotificationPreferences } from '../hooks/use-notification-preferences';
import { useRequestNotificationPermission } from '../hooks/use-request-notification-permission';

const GENERIC_WEEKLY_POINT = 'Un aviso por semana, el día y a la hora que elijas.';

/** Props of {@link PermissionIntroScreen}. */
export interface PermissionIntroScreenProps {
  /** Se llama al terminar, con "Activar recordatorios" (con cualquier resultado) o "Ahora no". */
  readonly onFinished: () => void;
}

/** Punto de la lista: ícono decorativo y texto, leídos como un solo elemento. */
function IntroPoint({ icon, text }: { readonly icon: IconProps['icon']; readonly text: string }) {
  return (
    <View accessible accessibilityLabel={text} className="flex-row items-center gap-3">
      <Icon icon={icon} color="muted" />
      <Text className="flex-1 text-base text-foreground">{text}</Text>
    </View>
  );
}

/**
 * Pantalla explicativa de la primera venta (D-06, F7.1, 3.1): dice exactamente qué va a llegar
 * y ofrece "Activar recordatorios" o "Ahora no". Volver equivale a "Ahora no": no pide nada. Un
 * "no" del sistema o un fallo vuelven sin mensaje; solo "Permitir" confirma el día y la hora.
 */
export function PermissionIntroScreen({ onFinished }: PermissionIntroScreenProps) {
  const preferences = useNotificationPreferences();
  const { request } = useRequestNotificationPermission();
  const toast = useAppToast();
  const title = useRef<ComponentRef<typeof Text>>(null);
  const scheduleFrame = useScheduleFrame();
  const isFinished = useRef(false);
  const isActivating = useRef(false);

  useEffect(() => {
    scheduleFrame(() => {
      if (title.current !== null) {
        AccessibilityInfo.sendAccessibilityEvent(title.current, 'focus');
      }
    });
  }, [scheduleFrame]);

  const weekly = preferences.data?.weekly;
  const weeklyPhrase =
    weekly === undefined
      ? undefined
      : `${weekdayPlural(weekly.weekday)} a las ${formatReminderTime(weekly.minuteOfDay)}`;

  const finish = () => {
    if (!isFinished.current) {
      isFinished.current = true;
      onFinished();
    }
  };

  const activate = async () => {
    if (isFinished.current || isActivating.current) {
      return;
    }
    isActivating.current = true;
    try {
      const result = await request();
      if (result === 'granted' && weeklyPhrase !== undefined) {
        toast.showSuccess(`Listo, te avisamos ${weeklyPhrase}.`);
      }
    } finally {
      finish();
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-6 px-4 pt-12 pb-4">
        <Icon icon={BellIcon} size="xl" color="muted" weight="duotone" />
        <Text
          ref={title}
          accessibilityRole="header"
          className="font-semibold text-title text-foreground"
        >
          ¿Te recordamos anotar tus ventas?
        </Text>
        <Text className="text-base text-foreground">
          Anotar una vez por semana es la forma más simple de saber cuánto vendes.
        </Text>
        <View className="gap-4">
          <IntroPoint
            icon={BellIcon}
            text={
              weeklyPhrase === undefined
                ? GENERIC_WEEKLY_POINT
                : `Un aviso por semana, ${weeklyPhrase}.`
            }
          />
          <IntroPoint
            icon={CalendarBlankIcon}
            text="El día 1 de cada mes, tu resumen del mes anterior."
          />
          <IntroPoint
            icon={GearIcon}
            text="Puedes cambiar el día y la hora, o apagarlos, en Ajustes."
          />
        </View>
        <Text className="text-sm text-muted">
          Nunca te llega más de un recordatorio por semana.
        </Text>
      </ScrollView>
      <StyledSafeAreaView edges={['bottom']} className="gap-2 px-4 pb-4">
        <PrimaryButton
          label="Activar recordatorios"
          onPress={() => {
            void activate();
          }}
        />
        <TextButton label="Ahora no" onPress={finish} />
      </StyledSafeAreaView>
    </Screen>
  );
}
