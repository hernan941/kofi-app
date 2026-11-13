import type { QueryDependency } from '@/core/providers/query/root-keys-to-invalidate';
import type { LocalDate, SaleRecordId } from '@/shared/domain';

/** Claves de consulta de ventas (ADR-009); el rango forma parte de la clave. */
export const salesKeys = {
  all: ['sales'] as const,
  between: (from: LocalDate, to: LocalDate) => ['sales', 'between', from, to] as const,
  recent: (pageSize: number) => ['sales', 'recent', pageSize] as const,
  detail: (id: SaleRecordId) => ['sales', 'detail', id] as const,
  weekStarts: (from: LocalDate, to: LocalDate) => ['sales', 'week-starts', from, to] as const,
};

/** Claves de las marcas de "no vendí". */
export const noSalesKeys = {
  all: ['no-sales-weeks'] as const,
  between: (from: LocalDate, to: LocalDate) => ['no-sales-weeks', 'between', from, to] as const,
};

/** Tablas de las que dependen las raíces de ventas (ADR-009). */
export const SALES_QUERY_DEPENDENCIES: readonly QueryDependency[] = [
  { rootKey: ['sales'], tables: new Set(['sale_records', 'sale_items']) },
  { rootKey: ['no-sales-weeks'], tables: new Set(['no_sales_weeks']) },
];
