import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { NotificationPermission } from '../domain/ports';
import { notificationKeys } from './query-keys';

/** Resultado de {@link useRequestNotificationPermission}. */
export interface RequestNotificationPermission {
  /**
   * Pide el permiso al sistema. Solo debe llamarse desde un toque. Resuelve con el resultado,
   * o `null` si ya había un pedido abierto o si falló (queda en el logger).
   */
  readonly request: () => Promise<NotificationPermission | null>;
  readonly isRequesting: boolean;
}

/**
 * Pide el permiso de avisos (D-06). Ignora un segundo toque mientras el diálogo del sistema
 * está abierto. Si se concede, pide una reconciliación; el resultado queda en la consulta del
 * permiso para que la pantalla lo muestre al instante.
 */
export function useRequestNotificationPermission(): RequestNotificationPermission {
  const { notifications, notificationReconciler, logger } = useDependencies();
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const request = async (): Promise<NotificationPermission | null> => {
    if (inFlight.current) {
      return null;
    }
    inFlight.current = true;
    setIsRequesting(true);
    try {
      const result = await notifications.requestPermission();
      queryClient.setQueryData(notificationKeys.permission(), result);
      if (result === 'granted') {
        void notificationReconciler.request();
      }
      return result;
    } catch (error) {
      logger.error('request_notification_permission_failed', error);
      return null;
    } finally {
      inFlight.current = false;
      setIsRequesting(false);
    }
  };

  return { request, isRequesting };
}
