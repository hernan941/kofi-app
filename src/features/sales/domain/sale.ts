import {
  clpSchema,
  type Clp,
  type EpochMs,
  type LocalDate,
  type NoSalesWeekId,
  type ProductId,
  type ProductVersionId,
  type SaleItemId,
  type SaleRecordId,
} from '@/shared/domain';

/** Códigos estables de canal (ADR-007); las etiquetas en español viven en la UI. */
export const SALE_CHANNELS = [
  'fair',
  'social_media',
  'store_or_consignment',
  'custom_order',
  'other',
] as const;

/** Canal por el que se vendió. */
export type SaleChannel = (typeof SALE_CHANNELS)[number];

/** Cantidad mínima por ítem. */
export const QUANTITY_MIN = 1;
/** Cantidad máxima por ítem (ADR-007). */
export const QUANTITY_MAX = 9999;
/** Longitud máxima de la nota (D-27). */
export const SALE_NOTE_MAX_LENGTH = 500;
/** Tope técnico de ítems por registro. */
export const SALE_ITEMS_MAX = 100;
/** Total máximo representable como `Clp`; los totales mayores se saturan acá. */
export const MAX_SALE_TOTAL: Clp = clpSchema.parse(clpSchema.maxValue);

/** Línea de un registro de venta con el precio realmente cobrado. */
export interface SaleItem {
  readonly id: SaleItemId;
  readonly productId: ProductId;
  readonly productVersionId: ProductVersionId;
  readonly quantity: number;
  readonly unitPrice: Clp;
  readonly unitCost: Clp | null;
  readonly position: number;
}

/** Lo vendido en una misma ocasión; `items` contiene solo los ítems activos, ordenados por `(position, id)`. */
export interface SaleRecord {
  readonly id: SaleRecordId;
  readonly soldOn: LocalDate;
  readonly channel: SaleChannel | null;
  readonly note: string | null;
  readonly items: readonly SaleItem[];
  readonly createdAt: EpochMs;
  readonly updatedAt: EpochMs;
}

/** Marca de "esta semana no vendí"; `weekStart` es siempre un lunes. */
export interface NoSalesWeek {
  readonly id: NoSalesWeekId;
  readonly weekStart: LocalDate;
}

/** Σ cantidad × `unitPrice`; satura en `MAX_SALE_TOTAL` y suma 0 sin ítems (ADR-007, regla 15). */
export function activeItemsTotal(items: readonly SaleItem[]): Clp {
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return clpSchema.parse(Math.min(total, MAX_SALE_TOTAL));
}

/** Total de un registro; tolera registros sin ítems. */
export function recordTotal(record: Pick<SaleRecord, 'items'>): Clp {
  return activeItemsTotal(record.items);
}

/** `true` si el registro tiene al menos un ítem activo. */
export function hasItems(record: Pick<SaleRecord, 'items'>): boolean {
  return record.items.length > 0;
}

/** Ids de los productos distintos de los ítems del registro, en orden de aparición. */
export function productIdsOf(record: Pick<SaleRecord, 'items'> | null | undefined): ProductId[] {
  return [...new Set(record?.items.map((item) => item.productId) ?? [])];
}
