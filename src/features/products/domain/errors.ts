/** Códigos estables de error de productos; la UI los traduce (ADR-010). */
export const PRODUCT_ERROR_CODES = [
  'required',
  'too_long',
  'version_name_required',
  'duplicate_version_name',
  'no_active_version',
  'version_not_found',
  'version_archived',
  'version_has_sales',
  'product_not_found',
  'too_many_photos',
  'duplicate_photo',
  'photo_not_found',
] as const;

/** Código de error de productos. */
export type ProductErrorCode = (typeof PRODUCT_ERROR_CODES)[number];

/**
 * Ruta del campo afectado, con la forma de las rutas de Zod y de React Hook Form:
 * `['name']`, `['versions', 1, 'name']`. Vacía si el error es del producto entero.
 */
export type ProductErrorPath = readonly (string | number)[];

/** Error de una regla de productos, asociado a un campo cuando corresponde. */
export interface ProductError {
  readonly code: ProductErrorCode;
  readonly path: ProductErrorPath;
}

/** Uno o más errores; un comando que falla devuelve todos los que encontró. */
export type ProductErrors = readonly [ProductError, ...ProductError[]];

/** Convierte una lista de errores en `ProductErrors`, o `null` si está vacía. */
export function toProductErrors(issues: readonly ProductError[]): ProductErrors | null {
  const [first, ...rest] = issues;
  return first === undefined ? null : [first, ...rest];
}
