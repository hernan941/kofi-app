import {
  err,
  ok,
  productIdSchema,
  productVersionIdSchema,
  type Clp,
  type Clock,
  type EpochMs,
  type IdGenerator,
  type ProductId,
  type ProductPhotoId,
  type ProductVersionId,
  type Result,
} from '@/shared/domain';

import { toProductErrors, type ProductError, type ProductErrors } from './errors';
import { activeVersionIssues, validateProduct, versionNameKey } from './rules';
import type { CreateProductInput, NewVersionInput, UpdateProductInput } from './schemas';
import { compareVersions, nextVersionPosition, removeVersion } from './version';

/** Nombre que recibe la primera versión cuando el producto pasa a tener dos (D-16). Es un dato, no un texto de UI. */
export const DEFAULT_FIRST_VERSION_NAME = 'Estándar';

/** Precio de una versión: fijo o a convenir al momento de vender. */
export type VersionPricing =
  { readonly mode: 'fixed'; readonly price: Clp } | { readonly mode: 'negotiable' };

/** Modalidad de venta de un producto (por ejemplo "Print A4"). */
export interface ProductVersion {
  readonly id: ProductVersionId;
  readonly productId: ProductId;
  readonly name: string | null;
  readonly pricing: VersionPricing;
  readonly cost: Clp | null;
  readonly position: number;
  readonly archivedAt: EpochMs | null;
}

/** Foto de un producto; el archivo `photos/<id>.jpg` vive fuera de la base (ADR-008). */
export interface ProductPhoto {
  readonly id: ProductPhotoId;
  readonly productId: ProductId;
  readonly position: number;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
}

/** Producto con sus versiones (activas y archivadas) y sus fotos. */
export interface Product {
  readonly id: ProductId;
  readonly name: string;
  readonly description: string | null;
  readonly versions: readonly ProductVersion[];
  readonly photos: readonly ProductPhoto[];
  readonly archivedAt: EpochMs | null;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
}

/** Lo que un comando necesita del entorno; se inyecta para que los tests sean deterministas. */
export interface CommandContext {
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

/** Contexto de los comandos que pueden quitar versiones. */
export interface VersionRemovalContext extends CommandContext {
  /** Versiones del producto con al menos un ítem activo en un registro activo. */
  readonly versionIdsWithSales: ReadonlySet<ProductVersionId>;
}

/** Versiones activas en orden; puede estar vacía en datos rotos. */
export function activeVersions(product: Product): readonly ProductVersion[] {
  return product.versions.filter((version) => version.archivedAt === null).sort(compareVersions);
}

/** `true` si hay exactamente una versión activa: la UI no muestra el concepto de versión. */
export function hasSingleActiveVersion(product: Product): boolean {
  return activeVersions(product).length === 1;
}

const ENYE_SORT_SUFFIX = '\uFFFF';

/** Clave de orden alfabético de la lista de productos (D-31); `ñ` queda después de `n`. */
export function productListSortKey(name: string): string {
  return versionNameKey(name).replaceAll('ñ', `n${ENYE_SORT_SUFFIX}`);
}

/** Orden de la lista de productos (D-31): alfabético sin mayúsculas ni tildes, `ñ` después de `n`; luego `createdAt` e id. */
export function compareProductsForList(a: Product, b: Product): number {
  const keyA = productListSortKey(a.name);
  const keyB = productListSortKey(b.name);
  if (keyA !== keyB) {
    return keyA < keyB ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildVersion(
  input: NewVersionInput,
  productId: ProductId,
  position: number,
  context: CommandContext,
): ProductVersion {
  return {
    id: productVersionIdSchema.parse(context.ids.next()),
    productId,
    name: input.name,
    pricing: input.pricing,
    cost: input.cost,
    position,
    archivedAt: null,
  };
}

/** Crea un producto con sus versiones (posiciones 0..n-1); `createdAt = updatedAt = clock.now()`. */
export function createProduct(
  input: CreateProductInput,
  context: CommandContext,
): Result<Product, ProductErrors> {
  const id = productIdSchema.parse(context.ids.next());
  const now = context.clock.now();
  const product: Product = {
    id,
    name: input.name,
    description: input.description,
    versions: input.versions.map((version, index) => buildVersion(version, id, index, context)),
    photos: [],
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return validateProduct(product);
}

function findReferenceIssues(current: Product, input: UpdateProductInput): readonly ProductError[] {
  const issues: ProductError[] = [];
  input.versions.forEach((version, index) => {
    if (!('id' in version)) {
      return;
    }
    const existing = current.versions.find((candidate) => candidate.id === version.id);
    if (existing === undefined) {
      issues.push({ code: 'version_not_found', path: ['versions', index] });
    } else if (existing.archivedAt !== null) {
      issues.push({ code: 'version_archived', path: ['versions', index] });
    }
  });
  return issues;
}

function applyEdits(current: Product, input: UpdateProductInput): Product {
  const edits = new Map(
    input.versions.flatMap((version) => ('id' in version ? [[version.id, version] as const] : [])),
  );
  return {
    ...current,
    versions: current.versions.map((version) => {
      const edit = edits.get(version.id);
      return edit === undefined
        ? version
        : { ...version, name: edit.name, pricing: edit.pricing, cost: edit.cost };
    }),
  };
}

interface CreationsResult {
  readonly product: Product;
  readonly inputIndexById: ReadonlyMap<ProductVersionId, number>;
}

function applyCreations(
  current: Product,
  input: UpdateProductInput,
  context: CommandContext,
): CreationsResult {
  const inputIndexById = new Map<ProductVersionId, number>();
  const product = input.versions.reduce<Product>((accumulated, version, index) => {
    if ('id' in version) {
      inputIndexById.set(version.id, index);
      return accumulated;
    }
    const created = buildVersion(
      version,
      accumulated.id,
      nextVersionPosition(accumulated),
      context,
    );
    inputIndexById.set(created.id, index);
    return { ...accumulated, versions: [...accumulated.versions, created] };
  }, current);
  return { product, inputIndexById };
}

function applyRemovals(
  current: Product,
  removedIds: readonly ProductVersionId[],
  context: VersionRemovalContext,
): Result<Product, ProductErrors> {
  let product = current;
  for (const id of removedIds) {
    const result = removeVersion(product, id, context);
    if (!result.ok) {
      return result;
    }
    product = result.value;
  }
  return ok(product);
}

/**
 * Edita nombre, descripción y versiones en un solo paso. Aplica en este orden, sin validar
 * los pasos intermedios: edita las versiones existentes, crea las nuevas (posición
 * `nextVersionPosition`), quita las de `removedVersionIds` con `removeVersion` y al final
 * llama a `validateProduct`. Las rutas de error se refieren a los índices de `input.versions`.
 * Una versión activa que no está en `versions` ni en `removedVersionIds` se conserva sin cambios.
 */
export function updateProduct(
  current: Product,
  input: UpdateProductInput,
  context: VersionRemovalContext,
): Result<Product, ProductErrors> {
  const referenceErrors = toProductErrors(findReferenceIssues(current, input));
  if (referenceErrors !== null) {
    return err(referenceErrors);
  }
  const edited = applyEdits(current, input);
  const { product: created, inputIndexById } = applyCreations(edited, input, context);
  const removed = applyRemovals(created, input.removedVersionIds, context);
  if (!removed.ok) {
    return removed;
  }
  const next: Product = {
    ...removed.value,
    name: input.name,
    description: input.description,
    versions: [...removed.value.versions].sort(compareVersions),
    updatedAt: context.clock.now(),
  };
  return validateProduct(
    next,
    (version, activeIndex) => inputIndexById.get(version.id) ?? activeIndex,
  );
}

/** Archiva; si ya estaba archivado devuelve el mismo producto (idempotente, sin cambiar `updatedAt`). */
export function archiveProduct(current: Product, clock: Clock): Product {
  if (current.archivedAt !== null) {
    return current;
  }
  const now = clock.now();
  return { ...current, archivedAt: now, updatedAt: now };
}

/** Desarchiva; falla con `no_active_version` si el producto quedó sin versiones activas (ADR-007, regla 15). Idempotente. */
export function unarchiveProduct(current: Product, clock: Clock): Result<Product, ProductErrors> {
  if (current.archivedAt === null) {
    return ok(current);
  }
  const errors = toProductErrors(activeVersionIssues(current));
  if (errors !== null) {
    return err(errors);
  }
  return ok({ ...current, archivedAt: null, updatedAt: clock.now() });
}
