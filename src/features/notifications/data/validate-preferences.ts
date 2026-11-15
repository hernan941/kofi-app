import { notificationPreferencesSchema, type NotificationPreferences } from '../domain/preferences';

/**
 * Valida las preferencias con el esquema del dominio.
 * @throws {RangeError} Si el día o el minuto están fuera de rango.
 */
export function assertValidPreferences(
  preferences: NotificationPreferences,
): NotificationPreferences {
  const parsed = notificationPreferencesSchema.safeParse(preferences);
  if (!parsed.success) {
    throw new RangeError('Invalid notification preferences');
  }
  return parsed.data;
}
