/** Códigos estables de error de ventas; la UI los traduce (ADR-010). */
export const SALE_ERROR_CODES = [
  'required',
  'too_long',
  'no_items',
  'too_many_items',
  'quantity_out_of_range',
  'price_required',
  'future_date',
  'product_not_found',
  'product_archived',
  'version_not_found',
  'version_product_mismatch',
  'version_archived',
  'item_not_found',
  'record_not_found',
  'week_has_sales',
  'week_not_allowed',
  'not_a_week_start',
] as const;

/** Código de error de ventas. */
export type SaleErrorCode = (typeof SALE_ERROR_CODES)[number];

/** Ruta del campo con la forma de Zod y React Hook Form: `['items', 1, 'unitPrice']`, `['soldOn']`. */
export type SaleErrorPath = readonly (string | number)[];

/** Error de una regla de ventas, asociado a un campo cuando corresponde. */
export interface SaleError {
  readonly code: SaleErrorCode;
  readonly path: SaleErrorPath;
}

/** Uno o más errores; un comando que falla devuelve todos los que encontró. */
export type SaleErrors = readonly [SaleError, ...SaleError[]];

/** Convierte una lista de errores en `SaleErrors`, o `null` si está vacía. */
export function toSaleErrors(issues: readonly SaleError[]): SaleErrors | null {
  const [first, ...rest] = issues;
  return first === undefined ? null : [first, ...rest];
}
