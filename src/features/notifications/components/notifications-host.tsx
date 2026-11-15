import {
  useNotificationTaps,
  type UseNotificationTapsOptions,
} from '../hooks/use-notification-taps';
import { useNotificationTriggers } from '../hooks/use-notification-triggers';

/** Props de {@link NotificationsHost}. */
export type NotificationsHostProps = UseNotificationTapsOptions;

/**
 * Componente sin interfaz que mantiene al día los avisos mientras la app está abierta:
 * reconcilia en cada disparador y atiende los toques sobre un aviso. Va dentro de la puerta de
 * migración, para que la base ya esté lista.
 */
export function NotificationsHost({ navigationReady, onOpen }: NotificationsHostProps) {
  useNotificationTriggers();
  useNotificationTaps({ navigationReady, onOpen });
  return null;
}
