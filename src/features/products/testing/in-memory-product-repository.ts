import type { DataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';
import type { Clp, ProductId, ProductPhotoId, ProductVersionId } from '@/shared/domain';

import type { ProductRepository, ProductWriter } from '../data/product-repository';
import { runAsPromise } from '@/core/db/run-as-promise';
import type { SaleSeed } from '../data/testing/sales-fixtures';
import {
  MAX_PHOTOS_PER_PRODUCT,
  orderedPhotos,
  type Product,
  type ProductVersion,
  type VersionPricing,
} from '../domain';

/** Opciones de {@link createInMemoryProductRepository}. */
export interface InMemoryProductRepositoryOptions {
  readonly dataChanges: DataChanges;
}

/** Doble en memoria de los dos puertos de productos, con un registro de ventas para los tests. */
export interface InMemoryProductRepository extends ProductRepository, ProductWriter {
  /** Registra una venta de una versión, con o sin borrado lógico del ítem o del registro. */
  addSale(seed: SaleSeed): void;
}

function compareById(a: { readonly id: string }, b: { readonly id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sortVersions(versions: readonly ProductVersion[]): readonly ProductVersion[] {
  return [...versions].sort((a, b) => a.position - b.position || compareById(a, b));
}

function sortProducts(list: readonly Product[]): readonly Product[] {
  return [...list].sort((a, b) => a.createdAt - b.createdAt || compareById(a, b));
}

function samePricing(a: VersionPricing, b: VersionPricing): boolean {
  return a.mode === 'fixed' && b.mode === 'fixed' ? a.price === b.price : a.mode === b.mode;
}

function sameVersion(a: ProductVersion, b: ProductVersion): boolean {
  return (
    a.id === b.id &&
    a.productId === b.productId &&
    a.name === b.name &&
    samePricing(a.pricing, b.pricing) &&
    a.cost === b.cost &&
    a.position === b.position &&
    a.archivedAt === b.archivedAt
  );
}

/**
 * Doble en memoria de `ProductRepository & ProductWriter` para los tests de UI. Cumple la misma
 * suite de contrato que la implementación Drizzle y emite `DataChanges` en cada escritura. Es un
 * objeto de funciones (no una clase) para poder reemplazar un método con un spread en los tests.
 *
 * Diferencia con Drizzle: Drizzle emite al confirmar la transacción más externa, una sola vez y
 * con la unión de las tablas tocadas, y no emite si la transacción se revierte. Con
 * `inlineTransactions` (sin base ni rollback) este doble emite de inmediato en cada escritura, y
 * conserva lo escrito aunque el bloque falle después.
 */
export function createInMemoryProductRepository({
  dataChanges,
}: InMemoryProductRepositoryOptions): InMemoryProductRepository {
  const stored = new Map<ProductId, Product>();
  const removedVersions = new Map<ProductVersionId, ProductVersion>();
  const sales: SaleSeed[] = [];

  const find = (id: ProductId): Product | null => {
    const product = stored.get(id);
    return product
      ? {
          ...product,
          versions: sortVersions(product.versions),
          photos: orderedPhotos(product.photos),
        }
      : null;
  };

  const activePhotoIds = (): ReadonlySet<ProductPhotoId> =>
    new Set([...stored.values()].flatMap((product) => product.photos.map((photo) => photo.id)));

  const savePhotosSync: ProductWriter['savePhotosSync'] = (productId, diff) => {
    const product = stored.get(productId);
    if (product === undefined) {
      throw new Error(`Unknown product ${productId}.`);
    }
    if (diff.inserted.length === 0 && diff.moved.length === 0 && diff.removed.length === 0) {
      return;
    }
    const active = new Set(product.photos.map((photo) => photo.id));
    const removable = diff.removed.filter((id) => active.has(id)).length;
    const resulting = product.photos.length + diff.inserted.length - removable;
    if (resulting > MAX_PHOTOS_PER_PRODUCT) {
      throw new Error(
        `Product ${productId} would have ${String(resulting)} active photos; the maximum is ${String(MAX_PHOTOS_PER_PRODUCT)}.`,
      );
    }
    const removed = new Set(diff.removed);
    const positions = new Map(diff.moved.map((move) => [move.id, move.position]));
    const photos = [
      ...product.photos
        .filter((photo) => !removed.has(photo.id))
        .map((photo) => ({ ...photo, position: positions.get(photo.id) ?? photo.position })),
      ...diff.inserted,
    ];
    stored.set(productId, { ...product, photos: orderedPhotos(photos) });
    dataChanges.emit(new Set<TableName>(['product_photos']));
  };

  const list = (archived: boolean): readonly Product[] =>
    sortProducts(
      [...stored.values()].filter((product) => (product.archivedAt !== null) === archived),
    )
      .map((product) => find(product.id))
      .filter((product): product is Product => product !== null);

  const allVersions = (): readonly ProductVersion[] => [
    ...[...stored.values()].flatMap((product) => product.versions),
    ...removedVersions.values(),
  ];

  const versionIdsWithSales = (productId: ProductId): ReadonlySet<ProductVersionId> => {
    const productByVersion = new Map(
      allVersions().map((version) => [version.id, version.productId]),
    );
    return new Set(
      sales
        .filter(
          (sale) =>
            productByVersion.get(sale.versionId) === productId &&
            sale.itemDeleted !== true &&
            sale.recordDeleted !== true,
        )
        .map((sale) => sale.versionId),
    );
  };

  const findVersions = (ids: readonly ProductVersionId[]): readonly ProductVersion[] => {
    const wanted = new Set(ids);
    return allVersions().filter((version) => wanted.has(version.id));
  };

  const saveSync = (product: Product): void => {
    const previous = stored.get(product.id)?.versions ?? [];
    const keptIds = new Set(product.versions.map((version) => version.id));
    const removed = previous.filter((version) => !keptIds.has(version.id));
    const blocked = removed.find((version) => versionIdsWithSales(product.id).has(version.id));
    if (blocked) {
      throw new Error(`Cannot delete product version ${blocked.id}: it has sales.`);
    }
    const previousById = new Map(previous.map((version) => [version.id, version]));
    const versionsChanged =
      removed.length > 0 ||
      product.versions.some((version) => {
        const before = previousById.get(version.id);
        return before === undefined || !sameVersion(before, version);
      });
    stored.set(product.id, {
      ...product,
      photos: stored.get(product.id)?.photos ?? [],
    });
    for (const version of product.versions) {
      removedVersions.delete(version.id);
    }
    for (const version of removed) {
      removedVersions.set(version.id, version);
    }
    const tables: TableName[] = versionsChanged ? ['products', 'product_versions'] : ['products'];
    dataChanges.emit(new Set(tables));
  };

  const setArchivedSync: ProductWriter['setArchivedSync'] = (id, archivedAt, now) => {
    const product = stored.get(id);
    if (product) {
      stored.set(id, { ...product, archivedAt, updatedAt: now });
    }
    dataChanges.emit(new Set<TableName>(['products']));
  };

  return {
    listActive: () => runAsPromise(() => list(false)),
    listArchived: () => runAsPromise(() => list(true)),
    findById: (id) => runAsPromise(() => find(id)),
    findVersionsByIds: (ids) => runAsPromise(() => findVersions(ids)),
    currentCostsFor: (ids) =>
      runAsPromise(
        () =>
          new Map<ProductVersionId, Clp | null>(
            findVersions(ids).map((version) => [version.id, version.cost]),
          ),
      ),
    versionIdsWithSales: (productId) => runAsPromise(() => versionIdsWithSales(productId)),
    save: (product) =>
      runAsPromise(() => {
        saveSync(product);
      }),
    setArchived: (id, archivedAt, now) =>
      runAsPromise(() => {
        setArchivedSync(id, archivedAt, now);
      }),
    activePhotoIds: () => runAsPromise(activePhotoIds),
    findByIds: (ids) =>
      runAsPromise(() =>
        [...new Set(ids)]
          .map((id) => find(id))
          .filter((product): product is Product => product !== null),
      ),
    findByIdSync: find,
    savePhotosSync,
    activePhotoIdsSync: activePhotoIds,
    versionIdsWithSalesSync: versionIdsWithSales,
    saveSync,
    setArchivedSync,
    addSale: (seed) => {
      sales.push(seed);
    },
  };
}
