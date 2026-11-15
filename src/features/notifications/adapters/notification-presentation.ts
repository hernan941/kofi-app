import * as Notifications from 'expo-notifications';

/**
 * Cómo se muestra un aviso que llega con la app abierta: banner y entrada en la lista, sin
 * sonido ni número en el ícono. Se instala una vez al componer las dependencias.
 */
export function installNotificationPresentation(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
  });
}
