import type { FieldError } from 'react-hook-form';

import type { ClpInputError, TextErrorCode } from '@/shared/domain';

/** Spanish text for the codes of the text schemas of `shared/domain`. */
export const TEXT_ERROR_MESSAGES: Readonly<Record<TextErrorCode, string>> = {
  required: 'Completa este campo',
  too_long: 'Es demasiado largo. Acórtalo un poco',
};

/** Spanish text for the codes of `parseClpInput`, each one says how to fix the amount. */
export const CLP_INPUT_ERROR_MESSAGES: Readonly<Record<ClpInputError, string>> = {
  empty: 'Escribe un monto, por ejemplo 15.000',
  invalid_format: 'Escribe solo números, por ejemplo 15.000',
  invalid_grouping: 'Revisa los puntos: escribe 15.000 o 15000',
  comma_not_allowed: 'Escribe el monto sin comas',
  negative_not_allowed: 'Escribe el monto sin el signo menos',
  too_large: 'Escribe un monto menor a 1.000.000.000',
};

/** Message for an error whose code no catalog knows. */
export const FALLBACK_ERROR_MESSAGE = 'Revisa este campo';

/** Message announced when the primary button reveals the errors of a form. */
export const FORM_ERRORS_ANNOUNCEMENT = 'Revisa los campos marcados';

/** Turns a form error into a message, looking up its code in `catalog`. */
export function describeWith(
  catalog: Readonly<Record<string, string>>,
): (error: FieldError) => string {
  return (error) => {
    const code = error.message ?? '';
    return Object.hasOwn(catalog, code)
      ? (catalog[code] ?? FALLBACK_ERROR_MESSAGE)
      : FALLBACK_ERROR_MESSAGE;
  };
}
