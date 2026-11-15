import type { AppDatabase } from '@/core/db/open';
import type { RunInTransaction } from '@/core/db/transaction';
import type { EpochMs } from '@/shared/domain';
import type { Logger } from '@/shared/lib/logger';

import type { NotificationPreferences } from '../domain/preferences';

/** Acceso a la fila única `'device'` de `notification_preferences` (ADR-007). */
export interface PreferencesRepository {
  /** Sin fila, o con una fila fuera de rango (que se registra), devuelve los valores por defecto. */
  get(): Promise<NotificationPreferences>;
  /**
   * Valida con `notificationPreferencesSchema` y hace upsert con `updated_at = now` en
   * `runInTransaction`, tocando `notification_preferences`.
   * @throws {RangeError} Si las preferencias no son válidas; no escribe nada.
   */
  save(preferences: NotificationPreferences, now: EpochMs): Promise<void>;
  /**
   * Instante del último recordatorio semanal que la reconciliación planificó, o `null` (D-13).
   * Es contabilidad interna del dispositivo: no viaja en el respaldo.
   */
  getLastWeeklyFireAt(): Promise<EpochMs | null>;
  /**
   * Guarda (o borra con `null`) ese instante sin tocar las preferencias. Si no hay fila, la crea
   * con los valores por defecto. No emite `DataChanges`: no es un cambio que la UI deba ver.
   */
  setLastWeeklyFireAt(instant: EpochMs | null, now: EpochMs): Promise<void>;
}

/** Acceso a la base que recibe la implementación Drizzle. */
export interface PreferencesDatabaseAccess {
  readonly db: () => AppDatabase;
  readonly runInTransaction: RunInTransaction;
  readonly logger: Logger;
}
