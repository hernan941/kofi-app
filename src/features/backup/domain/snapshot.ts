import type { SaleChannel } from '@/features/sales/domain';
import type { TipId } from '@/features/tips/domain';
import type {
  Clp,
  EpochMs,
  LocalDate,
  NoSalesWeekId,
  ProductId,
  ProductPhotoId,
  ProductVersionId,
  SaleItemId,
  SaleRecordId,
} from '@/shared/domain';

/**
 * Todas las filas de las tablas respaldables, incluidas las archivadas y las borradas
 * lógicamente. Sigue al esquema actual; `notification_preferences` no está (D-28).
 */
export interface DatabaseSnapshot {
  readonly products: readonly SnapshotProductRow[];
  readonly productVersions: readonly SnapshotProductVersionRow[];
  readonly productPhotos: readonly SnapshotProductPhotoRow[];
  readonly saleRecords: readonly SnapshotSaleRecordRow[];
  readonly saleItems: readonly SnapshotSaleItemRow[];
  readonly noSalesWeeks: readonly SnapshotNoSalesWeekRow[];
  readonly tipViews: readonly SnapshotTipViewRow[];
}

/** Fila de `products`. */
export interface SnapshotProductRow {
  readonly id: ProductId;
  readonly name: string;
  readonly description: string | null;
  readonly archivedAt: EpochMs | null;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

/** Fila de `product_versions`. */
export interface SnapshotProductVersionRow {
  readonly id: ProductVersionId;
  readonly productId: ProductId;
  readonly name: string | null;
  readonly pricingMode: 'fixed' | 'negotiable';
  readonly price: Clp | null;
  readonly cost: Clp | null;
  readonly position: number;
  readonly archivedAt: EpochMs | null;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

/** Fila de `product_photos`. */
export interface SnapshotProductPhotoRow {
  readonly id: ProductPhotoId;
  readonly productId: ProductId;
  readonly position: number;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

/** Fila de `sale_records`. */
export interface SnapshotSaleRecordRow {
  readonly id: SaleRecordId;
  readonly soldOn: LocalDate;
  readonly channel: SaleChannel | null;
  readonly note: string | null;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

/** Fila de `sale_items`. */
export interface SnapshotSaleItemRow {
  readonly id: SaleItemId;
  readonly saleRecordId: SaleRecordId;
  readonly productId: ProductId;
  readonly productVersionId: ProductVersionId;
  readonly quantity: number;
  readonly unitPrice: Clp;
  readonly unitCost: Clp | null;
  readonly position: number;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

/** Fila de `no_sales_weeks`. */
export interface SnapshotNoSalesWeekRow {
  readonly id: NoSalesWeekId;
  readonly weekStart: LocalDate;
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
  readonly deletedAt: EpochMs | null;
}

/** Fila de `tip_views`. */
export interface SnapshotTipViewRow {
  readonly tipId: TipId;
  readonly firstSeenAt: EpochMs;
  readonly updatedAt: EpochMs;
}

/** Nombres de las siete tablas respaldables. */
export type SnapshotTable =
  | 'products'
  | 'product_versions'
  | 'product_photos'
  | 'sale_records'
  | 'sale_items'
  | 'no_sales_weeks'
  | 'tip_views';

/** Columnas SQL de cada tabla que cubre el snapshot; el test de datos las compara con Drizzle. */
export const SNAPSHOT_COLUMNS: Readonly<Record<SnapshotTable, readonly string[]>> = {
  products: ['id', 'name', 'description', 'archived_at', 'created_at', 'updated_at', 'deleted_at'],
  product_versions: [
    'id',
    'product_id',
    'name',
    'pricing_mode',
    'price',
    'cost',
    'position',
    'archived_at',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  product_photos: [
    'id',
    'product_id',
    'position',
    'width',
    'height',
    'byte_size',
    'sha256',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  sale_records: ['id', 'sold_on', 'channel', 'note', 'created_at', 'updated_at', 'deleted_at'],
  sale_items: [
    'id',
    'sale_record_id',
    'product_id',
    'product_version_id',
    'quantity',
    'unit_price',
    'unit_cost',
    'position',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  no_sales_weeks: ['id', 'week_start', 'created_at', 'updated_at', 'deleted_at'],
  tip_views: ['tip_id', 'first_seen_at', 'updated_at'],
};
