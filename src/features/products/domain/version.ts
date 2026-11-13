import {
  err,
  ok,
  productVersionIdSchema,
  type Clock,
  type ProductVersionId,
  type Result,
} from '@/shared/domain';

import type { ProductError, ProductErrors } from './errors';
import {
  DEFAULT_FIRST_VERSION_NAME,
  type CommandContext,
  type Product,
  type ProductVersion,
  type VersionRemovalContext,
} from './product';
import { validateProduct, versionNameKey } from './rules';
import type { NewVersionInput } from './schemas';

/** Orden estable de versiones: por `position` y después por `id`. */
export function compareVersions(a: ProductVersion, b: ProductVersion): number {
  if (a.position !== b.position) {
    return a.position - b.position;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Posición de una versión nueva: máximo de las posiciones conocidas + 1, o 0. Nunca renumera. */
export function nextVersionPosition(product: Product): number {
  return product.versions.reduce((max, version) => Math.max(max, version.position + 1), 0);
}

/**
 * Nombre de la primera versión al agregar la segunda (D-16): "Estándar" o, si choca con
 * `otherNames` según `versionNameKey`, "Estándar 2", "Estándar 3", etc. (D-34).
 */
export function firstVersionNameOnSplit(otherNames: readonly (string | null)[]): string {
  const taken = new Set(
    otherNames.flatMap((name) => (name === null ? [] : [versionNameKey(name)])),
  );
  let candidate = DEFAULT_FIRST_VERSION_NAME;
  for (let n = 2; taken.has(versionNameKey(candidate)); n += 1) {
    candidate = `${DEFAULT_FIRST_VERSION_NAME} ${String(n)}`;
  }
  return candidate;
}

function fail(issue: ProductError): { readonly ok: false; readonly error: ProductErrors } {
  return err([issue]);
}

function hasActiveVersionBesides(product: Product, id: ProductVersionId): boolean {
  return product.versions.some((version) => version.archivedAt === null && version.id !== id);
}

function replaceVersion(
  product: Product,
  updated: ProductVersion,
  now: Product['updatedAt'],
): Product {
  return {
    ...product,
    versions: product.versions.map((version) => (version.id === updated.id ? updated : version)),
    updatedAt: now,
  };
}

/**
 * Agrega una versión. Si el producto tenía una sola versión activa sin nombre, esta recibe
 * `firstVersionNameOnSplit(nuevoNombre)` (D-16). La nueva versión debe tener nombre.
 */
export function addVersion(
  current: Product,
  input: NewVersionInput,
  context: CommandContext,
): Result<Product, ProductErrors> {
  const active = current.versions.filter((version) => version.archivedAt === null);
  const [only] = active;
  const shouldRenameFirst = only?.name === null && active.length === 1;
  const renamed = shouldRenameFirst
    ? replaceVersion(
        current,
        { ...only, name: firstVersionNameOnSplit([input.name]) },
        current.updatedAt,
      )
    : current;
  const created: ProductVersion = {
    id: productVersionIdSchema.parse(context.ids.next()),
    productId: current.id,
    name: input.name,
    pricing: input.pricing,
    cost: input.cost,
    position: nextVersionPosition(current),
    archivedAt: null,
  };
  return validateProduct({
    ...renamed,
    versions: [...renamed.versions, created].sort(compareVersions),
    updatedAt: context.clock.now(),
  });
}

/** Archiva una versión activa; falla con `no_active_version` si era la última. */
export function archiveVersion(
  current: Product,
  id: ProductVersionId,
  clock: Clock,
): Result<Product, ProductErrors> {
  const target = current.versions.find((version) => version.id === id);
  if (target === undefined) {
    return fail({ code: 'version_not_found', path: [] });
  }
  if (target.archivedAt !== null) {
    return fail({ code: 'version_archived', path: [] });
  }
  if (!hasActiveVersionBesides(current, id)) {
    return fail({ code: 'no_active_version', path: ['versions'] });
  }
  const now = clock.now();
  return ok(replaceVersion(current, { ...target, archivedAt: now }, now));
}

/** Borra lógicamente una versión sin ventas (deja de estar en `versions`); con ventas, `version_has_sales`. */
export function deleteVersion(
  current: Product,
  id: ProductVersionId,
  context: VersionRemovalContext,
): Result<Product, ProductErrors> {
  const target = current.versions.find((version) => version.id === id);
  if (target === undefined) {
    return fail({ code: 'version_not_found', path: [] });
  }
  if (context.versionIdsWithSales.has(id)) {
    return fail({ code: 'version_has_sales', path: [] });
  }
  if (target.archivedAt === null && !hasActiveVersionBesides(current, id)) {
    return fail({ code: 'no_active_version', path: ['versions'] });
  }
  return ok({
    ...current,
    versions: current.versions.filter((version) => version.id !== id),
    updatedAt: context.clock.now(),
  });
}

/** "Quitar" de la UI: archiva si la versión tiene ventas y la borra si no. */
export function removeVersion(
  current: Product,
  id: ProductVersionId,
  context: VersionRemovalContext,
): Result<Product, ProductErrors> {
  const target = current.versions.find((version) => version.id === id);
  if (target !== undefined && target.archivedAt !== null) {
    return fail({ code: 'version_archived', path: [] });
  }
  return context.versionIdsWithSales.has(id)
    ? archiveVersion(current, id, context.clock)
    : deleteVersion(current, id, context);
}
