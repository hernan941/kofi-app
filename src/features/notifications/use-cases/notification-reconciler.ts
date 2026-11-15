import type { Logger } from '@/shared/lib/logger';

import type { ReconcileSummary } from './reconcile-notifications';

/** Cola serializada en la que gana la última (ADR-011). */
export interface NotificationReconciler {
  /**
   * Pide una reconciliación. Si no hay ninguna en curso, empieza ya. Si hay una en curso, marca
   * "pendiente": al terminar la actual corre **una sola** más, con el estado de ese momento.
   * La promesa se resuelve cuando termina una ejecución que empezó después del pedido. Nunca se
   * rechaza: un fallo se registra en el logger y la cola sigue.
   */
  request(): Promise<void>;
}

/**
 * Crea la cola: a lo sumo una ejecución en curso y una pendiente. Todos los pedidos que llegan
 * mientras corre una se juntan en la pendiente, que lee el estado del momento en que empieza.
 * Así nunca se intercalan las operaciones de dos ejecuciones.
 */
export function createNotificationReconciler(
  run: () => Promise<ReconcileSummary>,
  logger: Logger,
): NotificationReconciler {
  let running: Promise<void> | null = null;
  let pending: Promise<void> | null = null;

  const execute = async (): Promise<void> => {
    try {
      await run();
    } catch (error) {
      logger.error('notifications_reconcile_failed', error);
    }
  };

  const start = (): Promise<void> => {
    const execution: Promise<void> = execute().then(() => {
      if (running === execution) {
        running = null;
      }
    });
    running = execution;
    return execution;
  };

  return {
    request: () => {
      if (pending !== null) {
        return pending;
      }
      if (running === null) {
        return start();
      }
      pending = running.then(() => {
        pending = null;
        return start();
      });
      return pending;
    },
  };
}
