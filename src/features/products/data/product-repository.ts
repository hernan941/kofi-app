import type { AppDatabase } from '@/core/db/open';
import type { RunInTransaction } from '@/core/db/transaction';
import type { Clp, EpochMs, ProductId, ProductPhotoId, ProductVersionId } from '@/shared/domain';

import type { PhotoDiff, Product, ProductVersion } from '../domain';

/** Acceso asíncrono a productos para las lecturas y escrituras simples (ADR-007). */
export interface ProductRepository {
  /** Productos no archivados ni borrados, con sus versiones no borradas y sus fotos. */
  listActive(): Promise<readonly Product[]>;
  /** Productos archivados (no borrados). */
  listArchived(): Promise<readonly Product[]>;
  /** Producto con sus versiones no borradas (ordenadas por posición) y sus fotos, o `null`. */
  findById(id: ProductId): Promise<Product | null>;
  /**
   * Versiones por id, en cualquier estado (activas, archivadas y, por tolerancia, borradas).
   * Los ids desconocidos se omiten.
   */
  findVersionsByIds(ids: readonly ProductVersionId[]): Promise<readonly ProductVersion[]>;
  /**
   * Costo actual de cada versión existente (D-26), también de las archivadas. Los ids
   * desconocidos no aparecen en el mapa.
   */
  currentCostsFor(
    ids: readonly ProductVersionId[],
  ): Promise<ReadonlyMap<ProductVersionId, Clp | null>>;
  /** Versiones del producto con al menos un `sale_item` activo cuyo `sale_record` también está activo. */
  versionIdsWithSales(productId: ProductId): Promise<ReadonlySet<ProductVersionId>>;
  /** Ids de todas las fotos con fila activa (`deleted_at IS NULL`), de cualquier producto, también de los archivados. */
  activePhotoIds(): Promise<ReadonlySet<ProductPhotoId>>;
  /**
   * Productos por id en cualquier estado salvo borrado, con sus versiones no borradas y fotos;
   * los ids desconocidos se omiten.
   */
  findByIds(ids: readonly ProductId[]): Promise<readonly Product[]>;
  /** Inserta o actualiza el producto y sus versiones por id; ver {@link ProductWriter.saveSync}. */
  save(product: Product): Promise<void>;
  /** Archiva (`archivedAt` con valor) o desarchiva (`null`) y actualiza `updated_at` con `now`. */
  setArchived(id: ProductId, archivedAt: EpochMs | null, now: EpochMs): Promise<void>;
}

/** Lecturas y escrituras síncronas para usar dentro de `TransactionRunner.run` (foundations, 3.2). */
export interface ProductWriter {
  findByIdSync(id: ProductId): Product | null;
  versionIdsWithSalesSync(productId: ProductId): ReadonlySet<ProductVersionId>;
  /**
   * Inserta o actualiza el producto y sus versiones por id:
   * - inserta las nuevas;
   * - actualiza solo las que cambiaron;
   * - borra lógicamente las que ya no están.
   *
   * No toca las fotos.
   * @throws {Error} Si se intenta borrar una versión con ventas (defensa en profundidad; el dominio ya lo impide).
   */
  saveSync(product: Product): void;
  setArchivedSync(id: ProductId, archivedAt: EpochMs | null, now: EpochMs): void;
  /**
   * Aplica el diff de fotos de un producto: inserta (`created_at = updated_at = now`),
   * actualiza `position` y `updated_at` de las movidas, y pone `deleted_at = now` en las quitadas.
   * @throws {Error} Si el resultado dejaría más de `MAX_PHOTOS_PER_PRODUCT` fotos activas (defensa en profundidad).
   */
  savePhotosSync(productId: ProductId, diff: PhotoDiff, now: EpochMs): void;
  /** Igual que `activePhotoIds`, sincrónico, para decidir dentro de una transacción. */
  activePhotoIdsSync(): ReadonlySet<ProductPhotoId>;
}

/** Acceso a la base que recibe la implementación Drizzle; la base se abre recién al primer uso. */
export interface ProductDatabaseAccess {
  readonly db: () => AppDatabase;
  readonly runInTransaction: RunInTransaction;
}
