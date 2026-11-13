import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { Result } from '@/shared/domain';

import type { ProductErrors } from '../domain';
import {
  setProductArchived,
  type SetProductArchivedCommand,
} from '../use-cases/set-product-archived';
import { useProductCommandDeps } from './use-product-command-deps';

/**
 * Archiva o desarchiva un producto. `mutateAsync` resuelve con el `Result` del dominio; solo
 * rechaza ante errores inesperados, que registra en el logger.
 */
export function useSetProductArchived(): UseMutationResult<
  Result<void, ProductErrors>,
  Error,
  SetProductArchivedCommand
> {
  const deps = useProductCommandDeps();
  const { logger } = useDependencies();
  return useMutation({
    mutationFn: async (command) => {
      try {
        return await setProductArchived(deps, command);
      } catch (error) {
        logger.error('set_product_archived_failed', error);
        throw error;
      }
    },
  });
}
