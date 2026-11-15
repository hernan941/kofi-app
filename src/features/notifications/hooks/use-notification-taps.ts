import { useCallback, useEffect, useRef } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';

import { parseNotificationTarget, type NotificationTarget } from '../domain/payload';
import type { NotificationTap } from '../domain/ports';
import { createTapDeduplicator } from '../domain/taps';

/** Opciones de {@link useNotificationTaps}. */
export interface UseNotificationTapsOptions {
  /** `true` cuando el navegador raíz está montado; antes no se navega. */
  readonly navigationReady: boolean;
  /** Navega; `null` = payload inválido, que abre Inicio. */
  readonly onOpen: (target: NotificationTarget | null) => void;
}

/** Destino esperando a que el navegador esté listo; `target` nulo significa payload inválido. */
interface PendingOpen {
  readonly target: NotificationTarget | null;
}

/**
 * Atiende lo que ocurre al tocar un aviso (ADR-011): el arranque en frío (`getLast`) y la app
 * abierta (`subscribe`). Ignora las acciones que no son la de por defecto, procesa cada toque
 * una sola vez (identificador más fecha de entrega), valida el payload con Zod, espera al
 * navegador raíz y después limpia la última respuesta para que no se repita.
 */
export function useNotificationTaps({ navigationReady, onOpen }: UseNotificationTapsOptions): void {
  const { notificationResponses, logger } = useDependencies();
  const deduplicator = useRef(createTapDeduplicator());
  const pending = useRef<PendingOpen | null>(null);
  const latest = useRef({ navigationReady, onOpen });

  const flush = useCallback(() => {
    const { navigationReady: isReady, onOpen: open } = latest.current;
    const next = pending.current;
    if (next === null || !isReady) {
      return;
    }
    pending.current = null;
    open(next.target);
    notificationResponses.clearLast().catch((error: unknown) => {
      logger.error('notification_clear_last_failed', error);
    });
  }, [notificationResponses, logger]);

  useEffect(() => {
    latest.current = { navigationReady, onOpen };
    flush();
  }, [navigationReady, onOpen, flush]);

  useEffect(() => {
    const handle = (tap: NotificationTap) => {
      if (!tap.isDefaultAction || !deduplicator.current.isNew(tap.key)) {
        return;
      }
      pending.current = { target: parseNotificationTarget(tap.data) };
      flush();
    };
    const last = notificationResponses.getLast();
    if (last !== null) {
      handle(last);
    }
    return notificationResponses.subscribe(handle);
  }, [notificationResponses, flush]);
}
