import { useDependencies } from '@/core/providers/dependencies-context';

import { scheduleTestReminders, type TestReminderMode } from '../use-cases/schedule-test-reminders';

/** Resultado de la acción de prueba; `failed` ya quedó en el logger. */
export type TestReminderOutcome = 'scheduled' | 'no_permission' | 'failed';

/** Acción de prueba (solo desarrollo y `e2e`): programa avisos `cvtest.*` cercanos. */
export function useScheduleTestReminders(): (
  mode: TestReminderMode,
) => Promise<TestReminderOutcome> {
  const { notifications, registeredWeeks, clock, calendar, logger } = useDependencies();
  return async (mode) => {
    try {
      return await scheduleTestReminders(
        {
          scheduler: notifications,
          weeks: registeredWeeks,
          clock,
          calendar,
        },
        mode,
      );
    } catch (error) {
      logger.error('schedule_test_reminders_failed', error);
      return 'failed';
    }
  };
}
