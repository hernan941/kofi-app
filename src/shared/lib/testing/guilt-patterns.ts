/**
 * Arma un patrón de palabra completa, sin distinguir mayúsculas y con letras Unicode
 * (el `\b` de JavaScript no entiende las tildes).
 */
function wholePhrase(phrase: string): RegExp {
  return new RegExp(`(?<![\\p{L}])${phrase}(?![\\p{L}])`, 'iu');
}

/**
 * Patrones de culpa que ningún texto de la app puede cumplir (`docs/product.md`: "nunca
 * mensajes de culpa"). Los comparten los tests de F4.4, F5.3, F6.4 y F7.2. Solo para tests.
 */
export const GUILT_PATTERNS: readonly RegExp[] = [
  wholePhrase('llevas'),
  wholePhrase('otra\\s+vez'),
  wholePhrase('deberías'),
  wholePhrase('debes'),
  wholePhrase('tienes\\s+que'),
  wholePhrase('todavía\\s+no'),
  wholePhrase('olvidaste'),
  wholePhrase('fallaste'),
  wholePhrase('perdiste'),
  wholePhrase('error'),
  wholePhrase('mal'),
];

/** Primer patrón de culpa que coincide con el texto, o `null` si el texto está limpio. */
export function findGuiltPattern(text: string): RegExp | null {
  return GUILT_PATTERNS.find((pattern) => pattern.test(text)) ?? null;
}
