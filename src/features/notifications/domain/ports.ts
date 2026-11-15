import type { WeekRange } from '@/shared/domain';

import type { ScheduledNotification } from './diff';
import type { PlannedNotification } from './plan';

/** Permiso de notificaciones simplificado para la UI (ADR-011). */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/** Puerto hacia el sistema de notificaciones (ADR-011). */
export interface NotificationScheduler {
  getPermission(): Promise<NotificationPermission>;
  /** Crea el canal `reminders` (Android) y después pide el permiso. Solo desde una acción del usuario. */
  requestPermission(): Promise<NotificationPermission>;
  /** Notificaciones de la app (prefijo `cv.`), reconstruidas desde su payload. */
  listScheduled(): Promise<readonly ScheduledNotification[]>;
  cancel(identifiers: readonly string[]): Promise<void>;
  /** Programa en orden, en el canal `reminders`; asegura el canal antes. */
  schedule(notifications: readonly PlannedNotification[]): Promise<void>;
}

/** Un toque sobre una notificación, normalizado por el adaptador. */
export interface NotificationTap {
  /** `request.identifier` + fecha de entrega: un `WEEKLY` repite el identifier cada semana. */
  readonly key: string;
  /** `true` si es la acción por defecto (tocar la notificación). */
  readonly isDefaultAction: boolean;
  readonly data: unknown;
}

/** Las dos vías de ADR-011: arranque en frío y app abierta. */
export interface NotificationResponseSource {
  /** Última respuesta conocida (`getLastNotificationResponse`), o `null`. */
  getLast(): NotificationTap | null;
  /** Respuestas nuevas mientras la app está abierta; devuelve la función de limpieza. */
  subscribe(listener: (tap: NotificationTap) => void): () => void;
  /**
   * `clearLastNotificationResponse` (síncrono en el módulo), para que no se repita en el próximo
   * arranque. Devuelve una promesa ya resuelta para que el puerto admita implementaciones asíncronas.
   */
  clearLast(): Promise<void>;
}

/** Si una semana tiene registro: una venta activa con ítems o una marca de "no vendí". */
export interface RegisteredWeekReader {
  isRegistered(week: WeekRange): Promise<boolean>;
}
