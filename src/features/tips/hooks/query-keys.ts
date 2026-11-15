import type { QueryDependency } from '@/core/providers/query/root-keys-to-invalidate';
import type { SaleRecordId } from '@/shared/domain';

/** Claves de consulta de los consejos vistos (ADR-009). */
export const tipKeys = {
  all: ['tips'] as const,
  views: () => ['tips', 'views'] as const,
};

/** Elección congelada por venta: no depende de ninguna tabla a propósito. */
export const tipAfterSaleKeys = {
  all: ['tip-after-sale'] as const,
  forRecord: (id: SaleRecordId) => ['tip-after-sale', id] as const,
};

/**
 * Tablas de las que dependen las raíces de consejos (ADR-009). `tip-after-sale` se registra
 * sin tablas para dejar explícito que nunca se invalida: marcar el consejo como visto no
 * debe provocar otra elección mientras la celebración sigue abierta.
 */
export const TIPS_QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['tips'], tables: new Set(['tip_views']) },
  { rootKey: ['tip-after-sale'], tables: new Set() },
];
