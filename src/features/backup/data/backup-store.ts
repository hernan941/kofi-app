import type { AppDatabase } from '@/core/db/open';
import type { RunInTransaction } from '@/core/db/transaction';

import type { DatabaseSnapshot } from '../domain/snapshot';

/** Acceso a la base que reciben los repositorios de Drizzle de `backup`. */
export interface BackupDatabaseAccess {
  readonly db: () => AppDatabase;
  readonly runInTransaction: RunInTransaction;
}

/** Conteos de lo que está vivo (sin borrado lógico) en la base. */
export interface ActiveCounts {
  readonly products: number;
  readonly saleRecords: number;
  readonly activePhotos: number;
}

/** Acceso a todas las tablas respaldables (ADR-006); `replaceAll` es la excepción de la restauración. */
export interface BackupStore {
  /** Lee las siete tablas completas en una sola transacción de solo lectura (sin `DataChanges`). */
  readSnapshot(): Promise<DatabaseSnapshot>;
  /**
   * Cuenta con `count(*)` los productos, ventas y fotos con `deletedAt` nulo, sin leer las filas.
   * Es lo que usa la vista previa de la restauración (D-45).
   */
  countActive(): Promise<ActiveCounts>;
  /**
   * En una sola `runInTransaction`: borra `sale_items`, `sale_records`, `no_sales_weeks`,
   * `product_photos`, `product_versions`, `products` y `tip_views` (hijos antes que padres) e
   * inserta el snapshot de padres a hijos, en lotes. Toca las siete tablas, así que `DataChanges`
   * las emite una vez después del commit. No toca `notification_preferences` (D-28) ni
   * `__drizzle_migrations`. Si algo falla, rollback completo y no emite nada.
   */
  replaceAll(snapshot: DatabaseSnapshot): Promise<void>;
}
