import {
  clpSchema,
  epochMsSchema,
  localDateSchema,
  productIdSchema,
  productVersionIdSchema,
  saleItemIdSchema,
  saleRecordIdSchema,
  type Clp,
  type EpochMs,
  type LocalDate,
  type ProductId,
  type ProductVersionId,
} from '@/shared/domain';
import type { Product, ProductVersion } from '@/features/products/domain';

import type { SaleItem, SaleRecord } from '../sale';
import type { SaleItemInput } from '../schemas';

/** Instante base de los tests. */
export const NOW = epochMsSchema.parse(1_700_000_000_000);
/** Instante posterior, el "ahora" de los comandos. */
export const LATER = epochMsSchema.parse(1_700_000_100_000);

/** Monto `Clp` de prueba. */
export function clp(value: number): Clp {
  return clpSchema.parse(value);
}

/** Instante de prueba. */
export function epoch(value: number): EpochMs {
  return epochMsSchema.parse(value);
}

/** Fecha local de prueba (`YYYY-MM-DD`). */
export function date(value: string): LocalDate {
  return localDateSchema.parse(value);
}

/** Id con un sufijo numérico fijo; `kind` separa las familias de ids. */
export function fixtureId(kind: number, n: number): string {
  return `${String(kind).repeat(8)}-${String(kind).repeat(4)}-7${String(kind).repeat(3)}-8${String(kind).repeat(3)}-${n.toString().padStart(12, '0')}`;
}

/** Id de producto de prueba. */
export function productId(n: number): ProductId {
  return productIdSchema.parse(fixtureId(1, n));
}

/** Id de versión de prueba. */
export function versionId(n: number): ProductVersionId {
  return productVersionIdSchema.parse(fixtureId(2, n));
}

/** Versión de prueba con precio fijo de 1000 y sin costo. */
export function makeVersion(
  n: number,
  overrides: Partial<ProductVersion> & { readonly productN?: number } = {},
): ProductVersion {
  const { productN = 1, ...rest } = overrides;
  return {
    id: versionId(n),
    productId: productId(productN),
    name: null,
    pricing: { mode: 'fixed', price: clp(1000) },
    cost: null,
    position: n,
    archivedAt: null,
    ...rest,
  };
}

/** Producto de prueba con las versiones dadas. */
export function makeProduct(
  n: number,
  versions: readonly ProductVersion[],
  overrides: Partial<Product> = {},
): Product {
  return {
    id: productId(n),
    name: 'Lámina',
    description: null,
    versions,
    photos: [],
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** Mapa de productos por id, como lo entrega el caso de uso. */
export function productsById(...products: readonly Product[]): ReadonlyMap<ProductId, Product> {
  return new Map(products.map((product) => [product.id, product]));
}

/** Ítem de venta de prueba; el id deriva de `n`. */
export function makeSaleItem(n: number, overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    id: saleItemIdSchema.parse(fixtureId(3, n)),
    productId: productId(1),
    productVersionId: versionId(1),
    quantity: 1,
    unitPrice: clp(1000),
    unitCost: null,
    position: n - 1,
    ...overrides,
  };
}

/** Registro de venta de prueba con las fechas y los ítems dados. */
export function makeSaleRecord(
  items: readonly SaleItem[] = [makeSaleItem(1)],
  overrides: Partial<SaleRecord> = {},
): SaleRecord {
  return {
    id: saleRecordIdSchema.parse(fixtureId(4, 1)),
    soldOn: date('2026-07-01'),
    channel: null,
    note: null,
    items,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** Entrada de ítem para la versión `versionN` del producto 1, sin `itemId` y con precio de la versión. */
export function makeItemInput(versionN = 1, overrides: Partial<SaleItemInput> = {}): SaleItemInput {
  return {
    itemId: null,
    productId: productId(1),
    productVersionId: versionId(versionN),
    quantity: 1,
    unitPrice: null,
    ...overrides,
  };
}
