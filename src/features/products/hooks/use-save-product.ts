import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { ProductId, Result } from '@/shared/domain';

import type { ProductErrors } from '../domain';
import { saveProduct, type SaveProductCommand } from '../use-cases/save-product';
import { useProductCommandDeps } from './use-product-command-deps';

/**
 * Crea o edita un producto. `mutateAsync` resuelve con el `Result` del dominio; solo rechaza
 * ante errores inesperados, que registra en el logger. No invalida la caché: lo hace el puente
 * de `DataChanges` después del commit.
 */
export function useSaveProduct(): UseMutationResult<
  Result<ProductId, ProductErrors>,
  Error,
  SaveProductCommand
> {
  const deps = useProductCommandDeps();
  const { logger } = useDependencies();
  return useMutation({
    mutationFn: async (command) => {
      try {
        return await saveProduct(deps, command);
      } catch (error) {
        logger.error('save_product_failed', error);
        throw error;
      }
    },
  });
}
