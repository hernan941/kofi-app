/**
 * Resultado de una operación de dominio que puede fallar por una regla de negocio.
 * Se usa en lugar de excepciones para los errores esperables.
 */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Construye un resultado exitoso. */
export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

/** Construye un resultado fallido. */
export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}
