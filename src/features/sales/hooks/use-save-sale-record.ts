import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { Result } from '@/shared/domain';

import type { SaleErrors } from '../domain';
import {
  saveSaleRecord,
  type SaveSaleRecordCommand,
  type SaveSaleRecordResult,
} from '../use-cases/save-sale-record';
import { useSalesCommandDeps } from './use-sales-command-deps';

/**
 * Crea o edita un registro. `mutateAsync` resuelve con el `Result` del dominio; solo rechaza
 * ante errores inesperados, que registra en el logger. No invalida la caché: lo hace el puente
 * de `DataChanges` después del commit.
 */
export function useSaveSaleRecord(): UseMutationResult<
  Result<SaveSaleRecordResult, SaleErrors>,
  Error,
  SaveSaleRecordCommand
> {
  const deps = useSalesCommandDeps();
  const { logger } = useDependencies();
  return useMutation({
    mutationFn: async (command) => {
      try {
        return await saveSaleRecord(deps, command);
      } catch (error) {
        logger.error('save_sale_record_failed', error);
        throw error;
      }
    },
  });
}
