import { Text, View } from 'react-native';

import { SecondaryButton, useAppToast } from '@/shared/ui';

import { useScheduleTestReminders } from '../hooks/use-schedule-test-reminders';
import type { TestReminderMode } from '../use-cases/schedule-test-reminders';

const SUCCESS_MESSAGES: Readonly<Record<TestReminderMode, string>> = {
  single: 'Aviso de prueba programado',
  sequence: 'Secuencia de prueba programada',
};

/**
 * Panel de prueba de avisos (F7.1, 3.5); solo se monta en desarrollo y en el build `e2e`.
 * Programa avisos `cvtest.*` cercanos, que la reconciliación no toca.
 */
export function TestReminderPanel() {
  const schedule = useScheduleTestReminders();
  const toast = useAppToast();

  const run = (mode: TestReminderMode) => {
    void schedule(mode).then((outcome) => {
      if (outcome === 'scheduled') {
        toast.showSuccess(SUCCESS_MESSAGES[mode]);
      } else {
        toast.showError('Activa los avisos para probarlos.');
      }
    });
  };

  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="font-semibold text-heading text-foreground">
        Pruebas de avisos
      </Text>
      <Text className="text-sm text-muted">Solo aparece en las versiones de prueba.</Text>
      <SecondaryButton
        label="Aviso en 1 minuto"
        onPress={() => {
          run('single');
        }}
      />
      <SecondaryButton
        label="Secuencia del estado B"
        onPress={() => {
          run('sequence');
        }}
      />
    </View>
  );
}
