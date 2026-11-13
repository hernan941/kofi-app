import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { Result } from '@/shared/domain';

import type { SaleErrors } from '../domain';
import { markNoSales, type NoSalesWeekCommand } from '../use-cases/mark-no-sales';
import { useSalesCommandDeps } from './use-sales-command-deps';

/** Marca una semana como "no vendí"; resuelve con el `Result` del dominio. */
export function useMarkNoSales(): UseMutationResult<
  Result<void, SaleErrors>,
  Error,
  NoSalesWeekCommand
> {
  const deps = useSalesCommandDeps();
  const { logger } = useDependencies();
  return useMutation({
    mutationFn: async (command) => {
      try {
        return await markNoSales(deps, command);
      } catch (error) {
        logger.error('mark_no_sales_failed', error);
        throw error;
      }
    },
  });
}
