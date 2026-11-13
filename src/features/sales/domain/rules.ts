import {
  err,
  isAfter,
  ok,
  saleItemIdSchema,
  saleRecordIdSchema,
  type Clp,
  type EpochMs,
  type IdGenerator,
  type LocalDate,
  type ProductId,
  type Result,
  type SaleItemId,
} from '@/shared/domain';
import type { Product, ProductVersion } from '@/features/products/domain';

import { toSaleErrors, type SaleError, type SaleErrors } from './errors';
import { SALE_ITEMS_MAX, type SaleItem, type SaleRecord } from './sale';
import type { SaleItemInput, SaveSaleRecordInput } from './schemas';

/** Lo que el dominio necesita saber de los productos de los ítems, leído en la transacción. */
export type ProductsById = ReadonlyMap<ProductId, Product>;

/**
 * D-03: `future_date` si `soldOn > today`. En una edición que **no** cambia la fecha no se
 * valida (un cambio de zona horaria pudo dejar una fecha "futura"; ADR-015, regla 6).
 */
export function validateSoldOn(
  soldOn: LocalDate,
  today: LocalDate,
  previous: LocalDate | null,
): readonly SaleError[] {
  if (previous === soldOn || !isAfter(soldOn, today)) {
    return [];
  }
  return [{ code: 'future_date', path: ['soldOn'] }];
}

/** D-26: el `unitCost` copiado si existe; si no, el costo actual recibido (que puede ser `null`). */
export function effectiveUnitCost(
  item: Pick<SaleItem, 'unitCost'>,
  currentCost: Clp | null,
): Clp | null {
  return item.unitCost ?? currentCost;
}

function itemPath(index: number, field: string): readonly (string | number)[] {
  return ['items', index, field];
}

function findOwningProduct(versionId: string, products: ProductsById): Product | undefined {
  return [...products.values()].find((product) =>
    product.versions.some((version) => version.id === versionId),
  );
}

interface VersionLookup {
  readonly version: ProductVersion | null;
  readonly issue: SaleError | null;
}

function lookupVersion(
  input: SaleItemInput,
  product: Product,
  products: ProductsById,
  index: number,
): VersionLookup {
  const path = itemPath(index, 'productVersionId');
  const version = product.versions.find((candidate) => candidate.id === input.productVersionId);
  if (version === undefined) {
    const owner = findOwningProduct(input.productVersionId, products);
    const code = owner === undefined ? 'version_not_found' : 'version_product_mismatch';
    return { version: null, issue: { code, path } };
  }
  if (version.productId !== product.id) {
    return { version: null, issue: { code: 'version_product_mismatch', path } };
  }
  if (version.archivedAt !== null) {
    return { version: null, issue: { code: 'version_archived', path } };
  }
  return { version, issue: null };
}

function priceFor(
  input: SaleItemInput,
  version: ProductVersion,
  index: number,
): Result<Clp, SaleError> {
  if (input.unitPrice !== null) {
    return ok(input.unitPrice);
  }
  if (version.pricing.mode === 'fixed') {
    return ok(version.pricing.price);
  }
  return err({ code: 'price_required', path: itemPath(index, 'unitPrice') });
}

function resolveChangedItem(
  input: SaleItemInput,
  products: ProductsById,
  index: number,
): Result<Omit<SaleItem, 'id' | 'position'>, SaleError> {
  const product = products.get(input.productId);
  if (product === undefined) {
    return err({ code: 'product_not_found', path: itemPath(index, 'productId') });
  }
  if (product.archivedAt !== null) {
    return err({ code: 'product_archived', path: itemPath(index, 'productId') });
  }
  const { version, issue } = lookupVersion(input, product, products, index);
  if (version === null) {
    return err(issue ?? { code: 'version_not_found', path: itemPath(index, 'productVersionId') });
  }
  const price = priceFor(input, version, index);
  if (!price.ok) {
    return price;
  }
  return ok({
    productId: input.productId,
    productVersionId: input.productVersionId,
    quantity: input.quantity,
    unitPrice: price.value,
    unitCost: version.cost,
  });
}

function keepsVersion(input: SaleItemInput, existing: SaleItem): boolean {
  return (
    existing.productId === input.productId && existing.productVersionId === input.productVersionId
  );
}

function resolveKeptItem(
  input: SaleItemInput,
  existing: SaleItem,
): Omit<SaleItem, 'id' | 'position'> {
  return {
    productId: existing.productId,
    productVersionId: existing.productVersionId,
    quantity: input.quantity,
    unitPrice: input.unitPrice ?? existing.unitPrice,
    unitCost: existing.unitCost,
  };
}

/**
 * Convierte la entrada en ítems de dominio:
 * - un ítem nuevo, o uno existente al que se le cambió la versión, exige que el producto
 *   exista y no esté archivado y que la versión exista, pertenezca al producto y no esté
 *   archivada; copia `unitCost = version.cost` (D-26);
 * - un ítem existente con la misma versión se acepta aunque el producto o la versión estén
 *   archivados o borrados y conserva su `unitCost` copiado;
 * - `unitPrice`: el recibido; si es `null`, el precio fijo de la versión (en un ítem existente
 *   sin cambio de versión, el `unitPrice` guardado); en "a convenir" sin precio, `price_required`;
 * - `position` es el índice en la entrada; `id` es `itemId` o `ids.next()`;
 * - un `itemId` que no está en `existing` (o repetido en la entrada) da `item_not_found`.
 *
 * Devuelve todos los errores que encuentra.
 */
export function resolveItems(
  input: readonly SaleItemInput[],
  products: ProductsById,
  existing: readonly SaleItem[],
  ids: IdGenerator,
): Result<readonly SaleItem[], SaleErrors> {
  if (input.length > SALE_ITEMS_MAX) {
    return err([{ code: 'too_many_items', path: ['items'] }]);
  }
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const usedIds = new Set<SaleItemId>();
  const issues: SaleError[] = [];
  const items: SaleItem[] = [];
  input.forEach((entry, index) => {
    const previous = entry.itemId === null ? undefined : existingById.get(entry.itemId);
    if (entry.itemId !== null && (previous === undefined || usedIds.has(entry.itemId))) {
      issues.push({ code: 'item_not_found', path: itemPath(index, 'itemId') });
      return;
    }
    const resolved =
      previous !== undefined && keepsVersion(entry, previous)
        ? ok(resolveKeptItem(entry, previous))
        : resolveChangedItem(entry, products, index);
    if (!resolved.ok) {
      issues.push(resolved.error);
      return;
    }
    const id = entry.itemId ?? saleItemIdSchema.parse(ids.next());
    usedIds.add(id);
    items.push({ ...resolved.value, id, position: index });
  });
  const errors = toSaleErrors(issues);
  return errors === null ? ok(items) : err(errors);
}

/** Diferencia por id entre los ítems guardados y los nuevos. Sin cambios, las tres listas van vacías. */
export interface SaleItemsDiff {
  readonly inserted: readonly SaleItem[];
  readonly updated: readonly SaleItem[];
  readonly removed: readonly SaleItemId[];
}

function itemsDiffer(a: SaleItem, b: SaleItem): boolean {
  return (
    a.productId !== b.productId ||
    a.productVersionId !== b.productVersionId ||
    a.quantity !== b.quantity ||
    a.unitPrice !== b.unitPrice ||
    a.unitCost !== b.unitCost ||
    a.position !== b.position
  );
}

/** Diferencia por id entre los ítems guardados y los nuevos. */
export function diffItems(before: readonly SaleItem[], after: readonly SaleItem[]): SaleItemsDiff {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterIds = new Set(after.map((item) => item.id));
  const inserted = after.filter((item) => !beforeById.has(item.id));
  const updated = after.filter((item) => {
    const previous = beforeById.get(item.id);
    return previous !== undefined && itemsDiffer(previous, item);
  });
  const removed = before.filter((item) => !afterIds.has(item.id)).map((item) => item.id);
  return { inserted, updated, removed };
}

/** Contexto de las reglas que crean entidades. */
export interface SaleCommandContext {
  readonly now: EpochMs;
  readonly today: LocalDate;
  readonly ids: IdGenerator;
}

function failWith(
  dateIssues: readonly SaleError[],
  itemResult: Result<readonly SaleItem[], SaleErrors>,
  extra: readonly SaleError[] = [],
): SaleErrors | null {
  const itemIssues = itemResult.ok ? [] : itemResult.error;
  return toSaleErrors([...dateIssues, ...itemIssues, ...extra]);
}

/** Crea un registro nuevo: valida fecha, ítems (`no_items` si no hay) y arma `SaleRecord` con `createdAt = updatedAt = now`. */
export function buildSaleRecord(
  input: SaveSaleRecordInput,
  products: ProductsById,
  context: SaleCommandContext,
): Result<SaleRecord, SaleErrors> {
  const dateIssues = validateSoldOn(input.soldOn, context.today, null);
  const itemResult = resolveItems(input.items, products, [], context.ids);
  const noItems: SaleError[] =
    input.items.length === 0 ? [{ code: 'no_items', path: ['items'] }] : [];
  const errors = failWith(dateIssues, itemResult, noItems);
  if (errors !== null || !itemResult.ok) {
    return err(errors ?? [{ code: 'no_items', path: ['items'] }]);
  }
  return ok({
    id: saleRecordIdSchema.parse(context.ids.next()),
    soldOn: input.soldOn,
    channel: input.channel,
    note: input.note,
    items: itemResult.value,
    createdAt: context.now,
    updatedAt: context.now,
  });
}

/** Resultado de planificar una edición. */
export type SaleRecordUpdatePlan =
  | {
      readonly kind: 'update';
      readonly record: SaleRecord;
      readonly diff: SaleItemsDiff;
      readonly changed: boolean;
    }
  | { readonly kind: 'delete' };

function isDiffEmpty(diff: SaleItemsDiff): boolean {
  return diff.inserted.length === 0 && diff.updated.length === 0 && diff.removed.length === 0;
}

/**
 * Edición: con `items` vacío devuelve `{ kind: 'delete' }` (la UI ya confirmó). Si no, aplica
 * `validateSoldOn` (con `previous = current.soldOn`), `resolveItems` y `diffItems`. `changed`
 * es `false` si no cambió ningún campo ni ítem; en ese caso el registro se devuelve igual y
 * `updatedAt` se conserva.
 */
export function planSaleRecordUpdate(
  current: SaleRecord,
  input: SaveSaleRecordInput,
  products: ProductsById,
  context: SaleCommandContext,
): Result<SaleRecordUpdatePlan, SaleErrors> {
  if (input.items.length === 0) {
    return ok({ kind: 'delete' });
  }
  const dateIssues = validateSoldOn(input.soldOn, context.today, current.soldOn);
  const itemResult = resolveItems(input.items, products, current.items, context.ids);
  const errors = failWith(dateIssues, itemResult);
  if (errors !== null || !itemResult.ok) {
    return err(errors ?? [{ code: 'no_items', path: ['items'] }]);
  }
  const diff = diffItems(current.items, itemResult.value);
  const changed =
    !isDiffEmpty(diff) ||
    input.soldOn !== current.soldOn ||
    input.channel !== current.channel ||
    input.note !== current.note;
  const record: SaleRecord = changed
    ? {
        ...current,
        soldOn: input.soldOn,
        channel: input.channel,
        note: input.note,
        items: itemResult.value,
        updatedAt: context.now,
      }
    : current;
  return ok({ kind: 'update', record, diff, changed });
}
