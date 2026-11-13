import type { QueryDependency } from '@/core/providers/query/root-keys-to-invalidate';
import type { ProductId } from '@/shared/domain';

/** Claves de consulta de productos. */
export const productKeys = {
  all: ['products'] as const,
  active: () => ['products', 'active'] as const,
  archived: () => ['products', 'archived'] as const,
  detail: (id: ProductId) => ['products', 'detail', id] as const,
  /** Productos por ids; los ids se ordenan y no se repiten para que el mismo conjunto comparta caché. */
  byIds: (ids: readonly ProductId[]) =>
    ['products', 'by-ids', ...[...new Set(ids)].sort()] as readonly string[],
};

/** Claves de uso de versiones en ventas; raíz aparte para no recargar productos al vender. */
export const productVersionUsageKeys = {
  all: ['product-version-usage'] as const,
  withSales: (productId: ProductId) => ['product-version-usage', productId] as const,
};

/** Tablas de las que dependen las raíces de productos (ADR-009). */
export const PRODUCTS_QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['products'], tables: new Set(['products', 'product_versions', 'product_photos']) },
  {
    rootKey: ['product-version-usage'],
    tables: new Set(['sale_items', 'sale_records', 'product_versions']),
  },
];
