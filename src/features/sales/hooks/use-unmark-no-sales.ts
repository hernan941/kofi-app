import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { Result } from '@/shared/domain';

import type { SaleErrors } from '../domain';
import type { NoSalesWeekCommand } from '../use-cases/mark-no-sales';
import { unmarkNoSales } from '../use-cases/unmark-no-sales';
import { useSalesCommandDeps } from './use-sales-command-deps';

/** Desmarca una semana de "no vendí"; resuelve con el `Result` del dominio. */
export function useUnmarkNoSales(): UseMutationResult<
  Result<void, SaleErrors>,
  Error,
  NoSalesWeekCommand
> {
  const deps = useSalesCommandDeps();
  const { logger } = useDependencies();
  return useMutation({
    mutationFn: async (command) => {
      try {
        return await unmarkNoSales(deps, command);
      } catch (error) {
        logger.error('unmark_no_sales_failed', error);
        throw error;
      }
    },
  });
}
