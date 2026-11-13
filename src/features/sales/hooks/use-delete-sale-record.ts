import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { Result, SaleRecordId } from '@/shared/domain';

import type { SaleErrors } from '../domain';
import { deleteSaleRecord } from '../use-cases/delete-sale-record';
import { useSalesCommandDeps } from './use-sales-command-deps';

/** Borra un registro (la confirmación la hace la UI); resuelve con el `Result` del dominio. */
export function useDeleteSaleRecord(): UseMutationResult<
  Result<void, SaleErrors>,
  Error,
  SaleRecordId
> {
  const deps = useSalesCommandDeps();
  const { logger } = useDependencies();
  return useMutation({
    mutationFn: async (recordId) => {
      try {
        return await deleteSaleRecord(deps, recordId);
      } catch (error) {
        logger.error('delete_sale_record_failed', error);
        throw error;
      }
    },
  });
}
