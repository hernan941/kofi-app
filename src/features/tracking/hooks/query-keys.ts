import type { QueryDependency } from '@/core/providers/query/root-keys-to-invalidate';
import type { LocalDate, ProductVersionId } from '@/shared/domain';

/** Raíz de lecturas de seguimiento sobre ventas y marcas. */
export const trackingKeys = {
  all: ['tracking'] as const,
  salesBetween: (from: LocalDate, to: LocalDate) =>
    ['tracking', 'sales-between', from, to] as const,
  latest: (limit: number) => ['tracking', 'latest', limit] as const,
  earliest: () => ['tracking', 'earliest'] as const,
  streak: (weekStart: LocalDate) => ['tracking', 'streak', weekStart] as const,
};

/**
 * Raíz aparte para que guardar una venta no recargue los costos y cambiar un costo no
 * recargue las ventas. La clave depende del conjunto de versiones pedidas.
 */
export const trackingCostKeys = {
  all: ['tracking-costs'] as const,
  forVersions: (ids: readonly ProductVersionId[]) => ['tracking-costs', ...ids] as const,
};

/** Tablas de las que dependen las raíces de seguimiento (ADR-009). */
export const TRACKING_QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['tracking'], tables: new Set(['sale_records', 'sale_items', 'no_sales_weeks']) },
  { rootKey: ['tracking-costs'], tables: new Set(['product_versions']) },
];
