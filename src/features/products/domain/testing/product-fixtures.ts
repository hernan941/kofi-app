import {
  clpSchema,
  epochMsSchema,
  productIdSchema,
  productVersionIdSchema,
  type Clp,
  type EpochMs,
  type ProductId,
  type ProductVersionId,
} from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';

import type { Product, ProductVersion } from '../product';

/** Instante base de los tests. */
export const NOW = epochMsSchema.parse(1_700_000_000_000);
/** Instante posterior, el que da el reloj de `makeContext`. */
export const LATER = epochMsSchema.parse(1_700_000_100_000);

/** Contexto determinista de comandos para los tests. */
export function makeContext(withSales: readonly ProductVersionId[] = []) {
  return {
    clock: new FakeClock(LATER),
    ids: new SequentialIdGenerator(),
    versionIdsWithSales: new Set(withSales),
  };
}

/** Id de producto o versión con un sufijo numérico fijo. */
export function fixtureId(n: number): string {
  return `11111111-1111-7111-8111-${n.toString().padStart(12, '0')}`;
}

/** Id del producto de prueba. */
export const PRODUCT_ID: ProductId = productIdSchema.parse(fixtureId(1));

/** Versión de prueba; el id deriva de `n`. */
export function makeVersion(n: number, overrides: Partial<ProductVersion> = {}): ProductVersion {
  return {
    id: productVersionIdSchema.parse(fixtureId(100 + n)),
    productId: PRODUCT_ID,
    name: null,
    pricing: { mode: 'fixed', price: clp(1000) },
    cost: null,
    position: n,
    archivedAt: null,
    ...overrides,
  };
}

/** Producto de prueba con las versiones dadas. */
export function makeProduct(
  versions: readonly ProductVersion[],
  overrides: Partial<Product> = {},
): Product {
  return {
    id: PRODUCT_ID,
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

/** Monto `Clp` de prueba. */
export function clp(value: number): Clp {
  return clpSchema.parse(value);
}

/** Instante de prueba. */
export function epoch(value: number): EpochMs {
  return epochMsSchema.parse(value);
}
