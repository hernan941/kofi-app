import { weekRangeOf, type Clock, type LocalCalendar } from '@/shared/domain';

import { TEST_NOTIFICATION_IDS, planTestReminder, planTestSequence } from '../domain/test-reminder';
import type { NotificationScheduler, RegisteredWeekReader } from '../domain/ports';

/** Puertos de la acción de prueba. */
export interface ScheduleTestRemindersDeps {
  readonly scheduler: Pick<NotificationScheduler, 'getPermission' | 'cancel' | 'schedule'>;
  readonly weeks: RegisteredWeekReader;
  readonly clock: Clock;
  readonly calendar: LocalCalendar;
}

/** Qué programar: un aviso en 1 minuto o la secuencia del estado B. */
export type TestReminderMode = 'single' | 'sequence';

/**
 * Acción de prueba (solo desarrollo y `e2e`): programa avisos `cvtest.*` cercanos para ver
 * los textos reales sin esperar una semana. El aviso único usa el texto que corresponde hoy
 * según la semana en curso. Antes de programar cancela cualquier tanda de prueba anterior (los ids
 * son fijos), así que hay a lo sumo una a la vez. La reconciliación no los toca, porque no empiezan con `cv.`.
 * @returns `no_permission` si el permiso no está concedido; no programa nada.
 */
export async function scheduleTestReminders(
  { scheduler, weeks, clock, calendar }: ScheduleTestRemindersDeps,
  mode: TestReminderMode,
): Promise<'scheduled' | 'no_permission'> {
  if ((await scheduler.getPermission()) !== 'granted') {
    return 'no_permission';
  }
  await scheduler.cancel(TEST_NOTIFICATION_IDS);
  const now = clock.now();
  if (mode === 'sequence') {
    await scheduler.schedule(planTestSequence({ now }));
    return 'scheduled';
  }
  const isRegistered = await weeks.isRegistered(weekRangeOf(calendar.localDateOf(now)));
  await scheduler.schedule(
    planTestReminder({ now, variant: isRegistered ? 'already_registered' : 'neutral' }),
  );
  return 'scheduled';
}
