import { err, ok, type Result } from '@/shared/domain';

import {
  toProductErrors,
  type ProductError,
  type ProductErrorPath,
  type ProductErrors,
} from './errors';
import type { Product, ProductVersion } from './product';

const ACCENTED_TO_PLAIN: Readonly<Record<string, string>> = {
  á: 'a',
  à: 'a',
  â: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
};
const ACCENTED_CHARACTERS = /[áàâéèêíìîóòôúùûü]/g;
const COMBINING_MARKS = /[\u0300-\u036F]/g;
const COMBINED_ENYE = /n\u0303/g;
const WHITESPACE_RUN = /\s+/g;

/**
 * Clave de comparación de un nombre de versión: recorta, colapsa los espacios internos,
 * pasa a minúsculas y quita las tildes (á, é, í, ó, ú, ü y sus variantes grave y circunfleja),
 * tanto precompuestas como combinantes (U+0300–U+036F). Usa una tabla propia, sin `Intl` ni
 * `String.prototype.normalize`, para que el resultado sea idéntico en Jest y en Hermes
 * (mismo criterio que ADR-010). La `ñ` se conserva (D-31).
 */
export function versionNameKey(name: string): string {
  return name
    .trim()
    .replace(WHITESPACE_RUN, ' ')
    .toLowerCase()
    .replace(COMBINED_ENYE, 'ñ')
    .replace(ACCENTED_CHARACTERS, (character) => ACCENTED_TO_PLAIN[character] ?? character)
    .replace(COMBINING_MARKS, '');
}

/** Nombre con el que se compara o se muestra una versión, tolerante a datos rotos. */
export interface VersionNameEntry {
  readonly name: string | null;
  readonly path: ProductErrorPath;
}

/**
 * Errores de nombre entre las versiones activas: con dos o más, cada una necesita nombre
 * (`version_name_required`) y no puede repetir la clave de una anterior (`duplicate_version_name`).
 * Con una sola, el nombre puede ser `null`. La usan los comandos y el formulario.
 */
export function versionNameIssues(active: readonly VersionNameEntry[]): readonly ProductError[] {
  if (active.length < 2) {
    return [];
  }
  const seen = new Set<string>();
  const issues: ProductError[] = [];
  for (const { name, path } of active) {
    const key = name === null ? '' : versionNameKey(name);
    if (key === '') {
      issues.push({ code: 'version_name_required', path });
    } else if (seen.has(key)) {
      issues.push({ code: 'duplicate_version_name', path });
    } else {
      seen.add(key);
    }
  }
  return issues;
}

/** `no_active_version` si no queda ninguna versión activa. */
export function activeVersionIssues(product: Product): readonly ProductError[] {
  const hasActive = product.versions.some((version) => version.archivedAt === null);
  return hasActive ? [] : [{ code: 'no_active_version', path: ['versions'] }];
}

/**
 * Invariantes de escritura de un producto (ADR-007, reglas 2 y 3). Los comandos la aplican
 * sobre el resultado final, nunca sobre pasos intermedios. `indexOf` permite que las rutas de
 * nombre usen otro índice que la posición entre las versiones activas.
 */
export function validateProduct(
  product: Product,
  indexOf?: (version: ProductVersion, activeIndex: number) => number,
): Result<Product, ProductErrors> {
  const active = product.versions.filter((version) => version.archivedAt === null);
  const entries = active.map((version, index) => ({
    name: version.name,
    path: ['versions', indexOf ? indexOf(version, index) : index, 'name'] as const,
  }));
  const errors = toProductErrors([...versionNameIssues(entries), ...activeVersionIssues(product)]);
  return errors === null ? ok(product) : err(errors);
}
