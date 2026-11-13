import { z } from 'zod';

import { err, ok, type Result } from './result';

const MAX_CLP = 999_999_999;
const THOUSANDS_GROUP_SIZE = 3;
const GROUPED_DIGITS = /^\d{1,3}(\.\d{3})+$/;
const PLAIN_DIGITS = /^\d+$/;
const NUMERIC_CHARACTERS = /^[\d.,]*$/;

/** Monto CLP no negativo; fuente única del tipo `Clp` (ADR-010). */
export const clpSchema = z.number().int().min(0).max(MAX_CLP).brand<'Clp'>();
/** Monto en pesos chilenos, entero sin decimales, entre 0 y 999.999.999. */
export type Clp = z.infer<typeof clpSchema>;

/** Monto CLP con signo, para resultados como la ganancia. */
export const signedClpSchema = z.number().int().min(-MAX_CLP).max(MAX_CLP).brand<'SignedClp'>();
/** Monto en pesos chilenos que puede ser negativo. */
export type SignedClp = z.infer<typeof signedClpSchema>;

/** Motivo estable por el que un texto no es un monto válido; la UI lo traduce. */
export type ClpInputError =
  | 'empty'
  | 'invalid_format'
  | 'invalid_grouping'
  | 'comma_not_allowed'
  | 'negative_not_allowed'
  | 'too_large';

/** Agrupa los dígitos de un entero no negativo con `.` cada tres cifras. */
function groupThousands(magnitude: number): string {
  const digits = String(magnitude);
  const firstGroupSize = digits.length % THOUSANDS_GROUP_SIZE || THOUSANDS_GROUP_SIZE;
  const groups = [digits.slice(0, firstGroupSize)];
  for (let index = firstGroupSize; index < digits.length; index += THOUSANDS_GROUP_SIZE) {
    groups.push(digits.slice(index, index + THOUSANDS_GROUP_SIZE));
  }
  return groups.join('.');
}

/** Valida que el monto sea un entero dentro del rango del tipo y devuelve su magnitud. */
function magnitudeOf(amount: Clp | SignedClp): number {
  if (!signedClpSchema.safeParse(amount).success) {
    throw new RangeError(`Amount out of range: ${String(amount)}`);
  }
  return Math.abs(amount);
}

/**
 * Formatea un monto como `$15.000` (o `-$5.000` si es negativo) sin recurrir a APIs de localización, para que
 * el resultado sea idéntico en Jest, Hermes para iOS y Hermes para Android.
 * @throws {RangeError} Si el valor no es un entero dentro del rango del tipo.
 */
export function formatClp(amount: Clp | SignedClp): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${groupThousands(magnitudeOf(amount))}`;
}

/**
 * Monto agrupado sin el signo `$` (`15.000`), como lo muestra un campo de monto.
 * @throws {RangeError} Si el valor no es un entero dentro del rango del tipo.
 */
export function formatClpDigits(amount: Clp): string {
  return groupThousands(magnitudeOf(amount));
}

/**
 * Variante del monto para lectores de pantalla: `15.000 pesos`, `1 peso` o `menos 5.000 pesos`.
 * @throws {RangeError} Si el valor no es un entero dentro del rango del tipo.
 */
export function formatClpAccessible(amount: Clp | SignedClp): string {
  const magnitude = magnitudeOf(amount);
  const prefix = amount < 0 ? 'menos ' : '';
  const unit = magnitude === 1 ? 'peso' : 'pesos';
  return `${prefix}${groupThousands(magnitude)} ${unit}`;
}

/** Clasifica un texto normalizado que no es un monto bien formado. */
function classifyMalformed(text: string): ClpInputError {
  if (text.startsWith('-') && NUMERIC_CHARACTERS.test(text.slice(1))) {
    return 'negative_not_allowed';
  }
  if (!NUMERIC_CHARACTERS.test(text)) {
    return 'invalid_format';
  }
  return text.includes(',') ? 'comma_not_allowed' : 'invalid_grouping';
}

/**
 * Interpreta el texto de un campo de monto. Quita los espacios y un `$` inicial, y acepta
 * solo dígitos sin separadores o miles agrupados con punto bien formados (ADR-010).
 */
export function parseClpInput(text: string): Result<Clp, ClpInputError> {
  const normalized = text.replace(/\s+/g, '').replace(/^\$/, '');
  if (normalized === '') {
    return err('empty');
  }
  if (!PLAIN_DIGITS.test(normalized) && !GROUPED_DIGITS.test(normalized)) {
    return err(classifyMalformed(normalized));
  }
  const parsed = clpSchema.safeParse(Number(normalized.replaceAll('.', '')));
  return parsed.success ? ok(parsed.data) : err('too_large');
}
