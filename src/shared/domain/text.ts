import { z } from 'zod';

/** Códigos de error estables de los esquemas de texto; la UI los traduce. */
export type TextErrorCode = 'required' | 'too_long';

const REQUIRED: TextErrorCode = 'required';
const TOO_LONG: TextErrorCode = 'too_long';

/** Texto obligatorio: recorta espacios, exige al menos un carácter y aplica un máximo. */
export function requiredTextSchema(maxLength: number) {
  return z.string().trim().min(1, { error: REQUIRED }).max(maxLength, { error: TOO_LONG });
}

/** Texto opcional: vacío, solo espacios, `null` o `undefined` se normalizan a `null`. */
export function optionalTextSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength, { error: TOO_LONG })
    .nullish()
    .transform((value): string | null => (value === undefined || value === '' ? null : value));
}
