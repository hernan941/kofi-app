import {
  clpSchema,
  epochMsSchema,
  localDateSchema,
  productIdSchema,
  productVersionIdSchema,
  saleItemIdSchema,
  saleRecordIdSchema,
  type Clp,
  type LocalDate,
  type ProductId,
  type ProductVersionId,
} from '@/shared/domain';
import type { SaleItem, SaleRecord } from '@/features/sales/domain';

/** Monto `Clp` de prueba. */
export function clp(value: number): Clp {
  return clpSchema.parse(value);
}

/** Fecha local de prueba (`YYYY-MM-DD`). */
export function day(value: string): LocalDate {
  return localDateSchema.parse(value);
}

function fixtureId(kind: number, n: number): string {
  const block = String(kind);
  return `${block.repeat(8)}-${block.repeat(4)}-7${block.repeat(3)}-8${block.repeat(3)}-${String(n).padStart(12, '0')}`;
}

/** Id de producto de prueba. */
export function productId(n: number): ProductId {
  return productIdSchema.parse(fixtureId(1, n));
}

/** Id de versión de prueba. */
export function versionId(n: number): ProductVersionId {
  return productVersionIdSchema.parse(fixtureId(2, n));
}

let itemCounter = 0;
let recordCounter = 0;

/** Ítem de venta de prueba; por defecto 1 unidad a $1.000 del producto 1, sin costo copiado. */
export function item(overrides: Partial<SaleItem> = {}): SaleItem {
  itemCounter += 1;
  return {
    id: saleItemIdSchema.parse(fixtureId(3, itemCounter)),
    productId: productId(1),
    productVersionId: versionId(1),
    quantity: 1,
    unitPrice: clp(1000),
    unitCost: null,
    position: 0,
    ...overrides,
  };
}

/** Registro de venta de prueba en la fecha dada. */
export function record(
  soldOn: string,
  items: readonly SaleItem[] = [item()],
  overrides: Partial<SaleRecord> = {},
): SaleRecord {
  recordCounter += 1;
  const instant = epochMsSchema.parse(1_700_000_000_000);
  return {
    id: saleRecordIdSchema.parse(fixtureId(4, recordCounter)),
    soldOn: day(soldOn),
    channel: null,
    note: null,
    items,
    createdAt: instant,
    updatedAt: instant,
    ...overrides,
  };
}

/** Registro de una sola línea con el monto total dado. */
export function saleOf(soldOn: string, total: number, overrides: Partial<SaleRecord> = {}) {
  return record(soldOn, [item({ unitPrice: clp(total) })], overrides);
}
