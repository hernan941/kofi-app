import * as Notifications from 'expo-notifications';

import type { NotificationResponseSource, NotificationTap } from '../domain/ports';

/** Normaliza una respuesta de Expo; la clave es identificador más fecha de entrega (ADR-011). */
function toTap(response: Notifications.NotificationResponse): NotificationTap {
  const { notification, actionIdentifier } = response;
  return {
    key: `${notification.request.identifier}@${String(notification.date)}`,
    isDefaultAction: actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER,
    data: notification.request.content.data,
  };
}

/**
 * `NotificationResponseSource` sobre `getLastNotificationResponse` (lo que hace por dentro
 * `useLastNotificationResponse`, para el arranque en frío) y el listener de respuestas (app
 * abierta). Se prueba sin `jest.mock` del módulo en los hooks que lo consumen (ADR-011).
 */
export function createExpoNotificationResponses(): NotificationResponseSource {
  return {
    getLast: () => {
      const last = Notifications.getLastNotificationResponse();
      return last === null ? null : toTap(last);
    },
    subscribe: (listener) => {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        listener(toTap(response));
      });
      return () => {
        subscription.remove();
      };
    },
    clearLast: () => {
      Notifications.clearLastNotificationResponse();
      return Promise.resolve();
    },
  };
}
