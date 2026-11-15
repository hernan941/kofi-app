/** Quita las tildes y demás marcas combinadas del texto (forma NFD sin diacríticos). */
function removeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Arma un patrón de palabra completa, sin distinguir mayúsculas y con letras Unicode
 * (el `\b` de JavaScript no entiende las tildes). Se escribe sin tildes porque
 * {@link findGuiltPattern} las quita del texto antes de comparar.
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
  wholePhrase('deberias'),
  wholePhrase('debes'),
  wholePhrase('tienes\\s+que'),
  wholePhrase('todavia\\s+no'),
  wholePhrase('aun\\s+no'),
  wholePhrase('no\\s+has'),
  wholePhrase('dejaste\\s+de'),
  wholePhrase('te\\s+faltan?'),
  wholePhrase('hace\\s+\\S+\\s+(dias|semanas)\\s+que\\s+no'),
  wholePhrase('olvidaste'),
  wholePhrase('fallaste'),
  wholePhrase('perdiste'),
  wholePhrase('error'),
  wholePhrase('mal'),
];

/**
 * Primer patrón de culpa que coincide con el texto, o `null` si el texto está limpio. Compara
 * sin tildes, así que "deberias" también cuenta.
 */
export function findGuiltPattern(text: string): RegExp | null {
  const plain = removeDiacritics(text);
  return GUILT_PATTERNS.find((pattern) => pattern.test(plain)) ?? null;
}
