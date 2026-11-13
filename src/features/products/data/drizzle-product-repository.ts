import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import type { AppDatabase } from '@/core/db/open';
import { productPhotos } from '@/core/db/schema/product-photos';
import { productVersions } from '@/core/db/schema/product-versions';
import { products } from '@/core/db/schema/products';
import { saleItems } from '@/core/db/schema/sale-items';
import { saleRecords } from '@/core/db/schema/sale-records';
import type { TouchedTables } from '@/core/db/transaction';
import type { Clp, EpochMs, ProductId, ProductPhotoId, ProductVersionId } from '@/shared/domain';

import {
  MAX_PHOTOS_PER_PRODUCT,
  type PhotoDiff,
  type Product,
  type ProductPhoto,
  type ProductVersion,
} from '../domain';
import type { ProductDatabaseAccess, ProductRepository, ProductWriter } from './product-repository';
import { runAsPromise } from '@/core/db/run-as-promise';

type ProductRow = typeof products.$inferSelect;
type VersionRow = typeof productVersions.$inferSelect;
type PhotoRow = typeof productPhotos.$inferSelect;
type VersionValues = Omit<typeof productVersions.$inferInsert, 'createdAt' | 'updatedAt'>;

function toVersion(row: VersionRow): ProductVersion {
  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    pricing:
      row.pricingMode === 'fixed' && row.price !== null
        ? { mode: 'fixed', price: row.price }
        : { mode: 'negotiable' },
    cost: row.cost,
    position: row.position,
    archivedAt: row.archivedAt,
  };
}

function toPhoto(row: PhotoRow): ProductPhoto {
  return {
    id: row.id,
    productId: row.productId,
    position: row.position,
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
    sha256: row.sha256,
  };
}

function toProduct(
  row: ProductRow,
  versions: readonly ProductVersion[],
  photos: readonly ProductPhoto[],
): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    versions,
    photos,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVersionValues(version: ProductVersion): VersionValues {
  return {
    id: version.id,
    productId: version.productId,
    name: version.name,
    pricingMode: version.pricing.mode,
    price: version.pricing.mode === 'fixed' ? version.pricing.price : null,
    cost: version.cost,
    position: version.position,
    archivedAt: version.archivedAt,
    deletedAt: null,
  };
}

function hasChanged(row: VersionRow, values: VersionValues): boolean {
  return (
    row.name !== values.name ||
    row.pricingMode !== values.pricingMode ||
    row.price !== values.price ||
    row.cost !== values.cost ||
    row.position !== values.position ||
    row.archivedAt !== values.archivedAt ||
    row.deletedAt !== null
  );
}

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group) {
      group.push(row);
    } else {
      groups.set(key(row), [row]);
    }
  }
  return groups;
}

function loadProducts(db: AppDatabase, rows: readonly ProductRow[]): readonly Product[] {
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map((row) => row.id);
  const versionRows = db
    .select()
    .from(productVersions)
    .where(and(inArray(productVersions.productId, ids), isNull(productVersions.deletedAt)))
    .orderBy(asc(productVersions.position), asc(productVersions.id))
    .all();
  const photoRows = db
    .select()
    .from(productPhotos)
    .where(and(inArray(productPhotos.productId, ids), isNull(productPhotos.deletedAt)))
    .orderBy(asc(productPhotos.position), asc(productPhotos.id))
    .all();
  const versionsByProduct = groupBy(versionRows, (row) => row.productId);
  const photosByProduct = groupBy(photoRows, (row) => row.productId);
  return rows.map((row) =>
    toProduct(
      row,
      (versionsByProduct.get(row.id) ?? []).map(toVersion),
      (photosByProduct.get(row.id) ?? []).map(toPhoto),
    ),
  );
}

function listProducts(db: AppDatabase, archived: boolean): readonly Product[] {
  const rows = db
    .select()
    .from(products)
    .where(
      and(
        isNull(products.deletedAt),
        archived ? isNotNull(products.archivedAt) : isNull(products.archivedAt),
      ),
    )
    .orderBy(asc(products.createdAt), asc(products.id))
    .all();
  return loadProducts(db, rows);
}

function findProduct(db: AppDatabase, id: ProductId): Product | null {
  const rows = db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .all();
  return loadProducts(db, rows)[0] ?? null;
}

function findVersionIdsWithSales(db: AppDatabase, productId: ProductId): Set<ProductVersionId> {
  const rows = db
    .selectDistinct({ versionId: saleItems.productVersionId })
    .from(saleItems)
    .innerJoin(saleRecords, eq(saleRecords.id, saleItems.saleRecordId))
    .innerJoin(productVersions, eq(productVersions.id, saleItems.productVersionId))
    .where(
      and(
        eq(productVersions.productId, productId),
        isNull(saleItems.deletedAt),
        isNull(saleRecords.deletedAt),
      ),
    )
    .all();
  return new Set(rows.map((row) => row.versionId));
}

function assertNoSalesOnRemoved(
  db: AppDatabase,
  productId: ProductId,
  removed: readonly VersionRow[],
): void {
  if (removed.length === 0) {
    return;
  }
  const withSales = findVersionIdsWithSales(db, productId);
  const blocked = removed.find((row) => withSales.has(row.id));
  if (blocked) {
    throw new Error(`Cannot delete product version ${blocked.id}: it has sales.`);
  }
}

function writeProduct(db: AppDatabase, product: Product): void {
  const values = {
    name: product.name,
    description: product.description,
    archivedAt: product.archivedAt,
    updatedAt: product.updatedAt,
  };
  db.insert(products)
    .values({ id: product.id, createdAt: product.createdAt, deletedAt: null, ...values })
    .onConflictDoUpdate({ target: products.id, set: values })
    .run();
}

function writeVersions(
  db: AppDatabase,
  product: Product,
  existing: readonly VersionRow[],
  removed: readonly VersionRow[],
): boolean {
  const existingById = new Map(existing.map((row) => [row.id, row]));
  let wrote = false;
  for (const version of product.versions) {
    const values = toVersionValues(version);
    const row = existingById.get(version.id);
    if (row === undefined) {
      db.insert(productVersions)
        .values({ ...values, createdAt: product.updatedAt, updatedAt: product.updatedAt })
        .run();
      wrote = true;
    } else if (hasChanged(row, values)) {
      db.update(productVersions)
        .set({ ...values, updatedAt: product.updatedAt })
        .where(eq(productVersions.id, version.id))
        .run();
      wrote = true;
    }
  }
  for (const row of removed) {
    db.update(productVersions)
      .set({ deletedAt: product.updatedAt, updatedAt: product.updatedAt })
      .where(eq(productVersions.id, row.id))
      .run();
    wrote = true;
  }
  return wrote;
}

function saveProductRows(db: AppDatabase, touched: TouchedTables, product: Product): void {
  const existing = db
    .select()
    .from(productVersions)
    .where(eq(productVersions.productId, product.id))
    .all();
  const keptIds = new Set(product.versions.map((version) => version.id));
  const removed = existing.filter((row) => row.deletedAt === null && !keptIds.has(row.id));
  assertNoSalesOnRemoved(db, product.id, removed);
  writeProduct(db, product);
  touched.add('products');
  if (writeVersions(db, product, existing, removed)) {
    touched.add('product_versions');
  }
}

function findProductsByIds(db: AppDatabase, ids: readonly ProductId[]): readonly Product[] {
  if (ids.length === 0) {
    return [];
  }
  const rows = db
    .select()
    .from(products)
    .where(and(inArray(products.id, [...ids]), isNull(products.deletedAt)))
    .orderBy(asc(products.createdAt), asc(products.id))
    .all();
  return loadProducts(db, rows);
}

function readActivePhotoIds(db: AppDatabase): ReadonlySet<ProductPhotoId> {
  const rows = db
    .select({ id: productPhotos.id })
    .from(productPhotos)
    .where(isNull(productPhotos.deletedAt))
    .all();
  return new Set(rows.map((row) => row.id));
}

function readActivePhotoIdsOf(db: AppDatabase, productId: ProductId): ReadonlySet<ProductPhotoId> {
  const rows = db
    .select({ id: productPhotos.id })
    .from(productPhotos)
    .where(and(eq(productPhotos.productId, productId), isNull(productPhotos.deletedAt)))
    .all();
  return new Set(rows.map((row) => row.id));
}

function activePhotoOf(productId: ProductId, id: ProductPhotoId) {
  return and(
    eq(productPhotos.id, id),
    eq(productPhotos.productId, productId),
    isNull(productPhotos.deletedAt),
  );
}

function writePhotoDiff(
  db: AppDatabase,
  touched: TouchedTables,
  productId: ProductId,
  diff: PhotoDiff,
  now: EpochMs,
): void {
  if (diff.inserted.length === 0 && diff.moved.length === 0 && diff.removed.length === 0) {
    return;
  }
  const active = readActivePhotoIdsOf(db, productId);
  const removable = diff.removed.filter((id) => active.has(id)).length;
  const resulting = active.size + diff.inserted.length - removable;
  if (resulting > MAX_PHOTOS_PER_PRODUCT) {
    throw new Error(
      `Product ${productId} would have ${String(resulting)} active photos; the maximum is ${String(MAX_PHOTOS_PER_PRODUCT)}.`,
    );
  }
  for (const photo of diff.inserted) {
    db.insert(productPhotos)
      .values({ ...photo, createdAt: now, updatedAt: now, deletedAt: null })
      .run();
  }
  for (const { id, position } of diff.moved) {
    db.update(productPhotos)
      .set({ position, updatedAt: now })
      .where(activePhotoOf(productId, id))
      .run();
  }
  for (const id of diff.removed) {
    db.update(productPhotos)
      .set({ deletedAt: now, updatedAt: now })
      .where(activePhotoOf(productId, id))
      .run();
  }
  touched.add('product_photos');
}

function archiveRows(
  db: AppDatabase,
  touched: TouchedTables,
  id: ProductId,
  archivedAt: EpochMs | null,
  now: EpochMs,
): void {
  db.update(products).set({ archivedAt, updatedAt: now }).where(eq(products.id, id)).run();
  touched.add('products');
}

/**
 * Implementación Drizzle de {@link ProductRepository} y {@link ProductWriter} sobre la misma
 * conexión. Los métodos asíncronos pasan por `runAsPromise`, así que cualquier excepción llega como rechazo. Las lecturas asíncronas usan la base directamente; las escrituras y los métodos
 * síncronos pasan por `runInTransaction`, que se une a la transacción externa si existe.
 */
export function createDrizzleProductRepository(
  access: ProductDatabaseAccess,
): ProductRepository & ProductWriter {
  const { runInTransaction } = access;

  const repository: ProductRepository & ProductWriter = {
    listActive: () => runAsPromise(() => listProducts(access.db(), false)),
    listArchived: () => runAsPromise(() => listProducts(access.db(), true)),
    findById: (id) => runAsPromise(() => findProduct(access.db(), id)),
    findVersionsByIds: (ids) =>
      runAsPromise(() =>
        ids.length === 0
          ? []
          : access
              .db()
              .select()
              .from(productVersions)
              .where(inArray(productVersions.id, [...ids]))
              .all()
              .map(toVersion),
      ),
    currentCostsFor: (ids) =>
      runAsPromise(
        () =>
          new Map<ProductVersionId, Clp | null>(
            ids.length === 0
              ? []
              : access
                  .db()
                  .select({ id: productVersions.id, cost: productVersions.cost })
                  .from(productVersions)
                  .where(inArray(productVersions.id, [...ids]))
                  .all()
                  .map((row) => [row.id, row.cost]),
          ),
      ),
    versionIdsWithSales: (productId) =>
      runAsPromise(() => findVersionIdsWithSales(access.db(), productId)),
    activePhotoIds: () => runAsPromise(() => readActivePhotoIds(access.db())),
    findByIds: (ids) => runAsPromise(() => findProductsByIds(access.db(), ids)),
    save: (product) =>
      runAsPromise(() => {
        repository.saveSync(product);
      }),
    setArchived: (id, archivedAt, now) =>
      runAsPromise(() => {
        repository.setArchivedSync(id, archivedAt, now);
      }),
    findByIdSync: (id) => runInTransaction((tx) => findProduct(tx, id)),
    versionIdsWithSalesSync: (productId) =>
      runInTransaction((tx) => findVersionIdsWithSales(tx, productId)),
    saveSync: (product) => {
      runInTransaction((tx, touched) => {
        saveProductRows(tx, touched, product);
      });
    },
    setArchivedSync: (id, archivedAt, now) => {
      runInTransaction((tx, touched) => {
        archiveRows(tx, touched, id, archivedAt, now);
      });
    },
    savePhotosSync: (productId, diff, now) => {
      runInTransaction((tx, touched) => {
        writePhotoDiff(tx, touched, productId, diff, now);
      });
    },
    activePhotoIdsSync: () => runInTransaction((tx) => readActivePhotoIds(tx)),
  };
  return repository;
}
