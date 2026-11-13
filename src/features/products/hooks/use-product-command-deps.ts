import { useDependencies } from '@/core/providers/dependencies-context';

import type { ProductCommandDeps } from '../use-cases/product-command-deps';

/** Puertos de los casos de uso de productos, tomados de las dependencias de la app. */
export function useProductCommandDeps(): ProductCommandDeps {
  const { transactions, productWriter, clock, ids, photos, fileLock, logger } = useDependencies();
  return { transactions, products: productWriter, clock, ids, photos, fileLock, logger };
}
