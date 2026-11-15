import type { IsoWeekday } from '@/shared/domain';

import type { NotificationPermission } from './ports';
import type { NotificationPreferences } from './preferences';

/** Estado de los recordatorios para el resumen de Ajustes. */
export type ReminderSummary =
  | { readonly kind: 'loading' }
  | { readonly kind: 'permission_off' }
  | { readonly kind: 'permission_pending' }
  | { readonly kind: 'all_off' }
  | {
      readonly kind: 'on';
      readonly weekly: { readonly weekday: IsoWeekday; readonly minuteOfDay: number } | null;
      readonly monthly: boolean;
    };

/**
 * Resume el estado de los recordatorios. Mientras falte la lectura de las preferencias o la del
 * permiso es `loading`. Si la persona apagó los dos avisos, es `all_off` aunque el permiso esté
 * sin decidir o denegado (no se le sugiere activar lo que eligió no recibir); después se revisa
 * el permiso.
 */
export function summarizeReminders(
  preferences: NotificationPreferences | undefined,
  permission: NotificationPermission | undefined,
): ReminderSummary {
  if (preferences === undefined || permission === undefined) {
    return { kind: 'loading' };
  }
  const { weekly, monthly } = preferences;
  if (!weekly.enabled && !monthly.enabled) {
    return { kind: 'all_off' };
  }
  if (permission === 'denied') {
    return { kind: 'permission_off' };
  }
  if (permission === 'undetermined') {
    return { kind: 'permission_pending' };
  }
  return {
    kind: 'on',
    weekly: weekly.enabled ? { weekday: weekly.weekday, minuteOfDay: weekly.minuteOfDay } : null,
    monthly: monthly.enabled,
  };
}
