import type { AppDatabase } from '@/core/db/open';
import type { RunInTransaction } from '@/core/db/transaction';
import type { EpochMs, LocalDate, NoSalesWeekId, SaleRecordId } from '@/shared/domain';

import type { NoSalesWeek, SaleRecord } from '../domain';

/** Cursor estable de la lista reciente: el último registro de la página anterior (ADR-007). */
export interface SaleRecordCursor {
  readonly soldOn: LocalDate;
  readonly createdAt: EpochMs;
  readonly id: SaleRecordId;
}

/** Una página de registros recientes; `next` es `null` en la última. */
export interface SaleRecordPage {
  readonly records: readonly SaleRecord[];
  readonly next: SaleRecordCursor | null;
}

/** Acceso asíncrono a ventas (ADR-007); los rangos son cerrados y excluyen lo borrado. */
export interface SaleRepository {
  /** Orden `(sold_on, created_at, id)` ascendente. Incluye registros sin ítems activos (`items: []`). */
  listBetween(from: LocalDate, to: LocalDate): Promise<readonly SaleRecord[]>;
  /**
   * Orden `(sold_on, created_at, id)` descendente, con paginación *keyset*: si hay `cursor`,
   * solo trae lo estrictamente anterior a él.
   */
  listRecent(limit: number, cursor?: SaleRecordCursor): Promise<SaleRecordPage>;
  /** Registro activo con sus ítems activos, o `null`. */
  findById(id: SaleRecordId): Promise<SaleRecord | null>;
  /** Inserta o actualiza; ver {@link SaleRecordWriter.saveSync}. */
  save(record: SaleRecord): Promise<void>;
  /** Borra lógicamente el registro y sus ítems; no hace nada si no existe. */
  softDelete(id: SaleRecordId, now: EpochMs): Promise<void>;
  /**
   * Lunes de las semanas con algún registro activo con al menos un ítem activo y `sold_on` en
   * el rango cerrado, sin repetir y ascendentes. Se calcula con `isoWeekStart` en TS (ADR-015).
   */
  activeWeekStartsBetween(from: LocalDate, to: LocalDate): Promise<readonly LocalDate[]>;
  /** El `sold_on` más antiguo de un registro activo con al menos un ítem activo, o `null`. */
  earliestSoldOn(): Promise<LocalDate | null>;
}

/** Lecturas y escrituras síncronas para usar dentro de `TransactionRunner.run` (foundations, 3.2). */
export interface SaleRecordWriter {
  findByIdSync(id: SaleRecordId): SaleRecord | null;
  /**
   * Inserta o actualiza el registro y sus ítems por id (ADR-007, regla 12), con `diffItems`
   * contra lo guardado: inserta los nuevos, actualiza solo los que cambiaron y pone
   * `deleted_at` en los que ya no están. `created_at` y `updated_at` de los ítems escritos son
   * `record.updatedAt`.
   * @throws {Error} Si `items` está vacío o si `item.productId` no coincide con la versión.
   */
  saveSync(record: SaleRecord): void;
  /** Borra lógicamente el registro y sus ítems activos; `false` si no existía o ya estaba borrado. */
  softDeleteSync(id: SaleRecordId, now: EpochMs): boolean;
  /** Algún registro activo con al menos un ítem activo y `sold_on` en el rango cerrado. */
  hasSalesBetweenSync(from: LocalDate, to: LocalDate): boolean;
  /** Si existió alguna vez un registro, incluidos los borrados. */
  hasAnyRecordEverSync(): boolean;
}

/** Acceso a las marcas de "no vendí" (ADR-007). */
export interface NoSalesWeekRepository {
  /** Marcas activas con `week_start` en el rango cerrado, ascendentes. */
  listBetween(from: LocalDate, to: LocalDate): Promise<readonly NoSalesWeek[]>;
  /** Marca la semana; ver {@link NoSalesWeekWriter.markSync}. */
  mark(week: NoSalesWeek, now: EpochMs): Promise<void>;
  /** Desmarca la semana; ver {@link NoSalesWeekWriter.unmarkSync}. */
  unmark(id: NoSalesWeekId, now: EpochMs): Promise<void>;
}

/** Escrituras síncronas de marcas; devuelven si cambiaron algo, para emitir solo cuando corresponde. */
export interface NoSalesWeekWriter {
  isMarkedSync(id: NoSalesWeekId): boolean;
  /** Inserta la fila con el id determinista o limpia `deleted_at` de la existente; `false` si ya estaba activa. */
  markSync(week: NoSalesWeek, now: EpochMs): boolean;
  /** Pone `deleted_at`; `false` si no existía o ya estaba desmarcada. */
  unmarkSync(id: NoSalesWeekId, now: EpochMs): boolean;
}

/** Igual que `ProductDatabaseAccess`: la base se abre recién al primer uso. */
export interface SalesDatabaseAccess {
  readonly db: () => AppDatabase;
  readonly runInTransaction: RunInTransaction;
}
