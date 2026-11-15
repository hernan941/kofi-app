import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';

import type { TipId } from '../domain';

/**
 * Marca un consejo como visto con el instante actual. Un fallo se registra y no se muestra:
 * que no quede guardado no debe bloquear nada.
 */
export function useMarkTipSeen(): UseMutationResult<void, Error, TipId> {
  const { tipViews, clock, logger } = useDependencies();
  return useMutation({
    mutationFn: (id) => tipViews.markSeen(id, clock.now()),
    onError: (error) => {
      logger.error('mark_tip_seen_failed', error);
    },
  });
}
