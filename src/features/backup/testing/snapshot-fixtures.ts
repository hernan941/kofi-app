import { tipIdSchema } from '@/features/tips/domain';
import {
  clpSchema,
  epochMsSchema,
  localDateSchema,
  noSalesWeekIdSchema,
  productIdSchema,
  productPhotoIdSchema,
  productVersionIdSchema,
  saleItemIdSchema,
  saleRecordIdSchema,
  deterministicId,
} from '@/shared/domain';

import type {
  DatabaseSnapshot,
  SnapshotProductPhotoRow,
  SnapshotProductRow,
  SnapshotProductVersionRow,
  SnapshotSaleItemRow,
  SnapshotSaleRecordRow,
} from '../domain/snapshot';

/** Id determinista de prueba con un prefijo por tipo y un número. */
export function testId(prefix: number, n: number): string {
  return `${prefix.toString(16).padStart(8, '0')}-0000-7000-8000-${n.toString().padStart(12, '0')}`;
}

/** Instante de prueba: `n` segundos después de una base fija. */
export function at(n: number) {
  return epochMsSchema.parse(1_700_000_000_000 + n * 1000);
}

/** Producto de prueba con valores por defecto. */
export function productRow(n: number, overrides: Partial<SnapshotProductRow> = {}) {
  return {
    id: productIdSchema.parse(testId(1, n)),
    name: `Producto ${String(n)}`,
    description: null,
    archivedAt: null,
    createdAt: at(n),
    updatedAt: at(n),
    deletedAt: null,
    ...overrides,
  } satisfies SnapshotProductRow;
}

/** Versión de prueba (precio fijo de $1.000 por defecto). */
export function versionRow(
  n: number,
  productN: number,
  overrides: Partial<SnapshotProductVersionRow> = {},
) {
  return {
    id: productVersionIdSchema.parse(testId(2, n)),
    productId: productIdSchema.parse(testId(1, productN)),
    name: null,
    pricingMode: 'fixed',
    price: clpSchema.parse(1000),
    cost: null,
    position: 0,
    archivedAt: null,
    createdAt: at(n),
    updatedAt: at(n),
    deletedAt: null,
    ...overrides,
  } satisfies SnapshotProductVersionRow;
}

/** Foto de prueba. */
export function photoRow(
  n: number,
  productN: number,
  overrides: Partial<SnapshotProductPhotoRow> = {},
) {
  return {
    id: productPhotoIdSchema.parse(testId(3, n)),
    productId: productIdSchema.parse(testId(1, productN)),
    position: 0,
    width: 800,
    height: 600,
    byteSize: 1234,
    sha256: 'a'.repeat(64),
    createdAt: at(n),
    updatedAt: at(n),
    deletedAt: null,
    ...overrides,
  } satisfies SnapshotProductPhotoRow;
}

/** Registro de venta de prueba. */
export function recordRow(n: number, overrides: Partial<SnapshotSaleRecordRow> = {}) {
  return {
    id: saleRecordIdSchema.parse(testId(4, n)),
    soldOn: localDateSchema.parse('2026-03-02'),
    channel: null,
    note: null,
    createdAt: at(n),
    updatedAt: at(n),
    deletedAt: null,
    ...overrides,
  } satisfies SnapshotSaleRecordRow;
}

/** Ítem de venta de prueba. */
export function itemRow(
  n: number,
  recordN: number,
  productN: number,
  versionN: number,
  overrides: Partial<SnapshotSaleItemRow> = {},
) {
  return {
    id: saleItemIdSchema.parse(testId(5, n)),
    saleRecordId: saleRecordIdSchema.parse(testId(4, recordN)),
    productId: productIdSchema.parse(testId(1, productN)),
    productVersionId: productVersionIdSchema.parse(testId(2, versionN)),
    quantity: 2,
    unitPrice: clpSchema.parse(1000),
    unitCost: null,
    position: 0,
    createdAt: at(n),
    updatedAt: at(n),
    deletedAt: null,
    ...overrides,
  } satisfies SnapshotSaleItemRow;
}

/** Semana sin ventas de prueba (el id es el UUIDv5 del lunes). */
export function noSalesWeekRow(weekStart: string, n = 1) {
  return {
    id: noSalesWeekIdSchema.parse(deterministicId(weekStart)),
    weekStart: localDateSchema.parse(weekStart),
    createdAt: at(n),
    updatedAt: at(n),
    deletedAt: null,
  };
}

/** Snapshot vacío. */
export const EMPTY_SNAPSHOT: DatabaseSnapshot = {
  products: [],
  productVersions: [],
  productPhotos: [],
  saleRecords: [],
  saleItems: [],
  noSalesWeeks: [],
  tipViews: [],
};

/**
 * Snapshot completo y coherente: un producto archivado, uno con dos versiones (una a convenir y
 * una archivada), filas borradas lógicamente, `null` en todos los campos que lo admiten y textos
 * con tildes.
 */
export function richSnapshot(): DatabaseSnapshot {
  return {
    products: [
      productRow(1, { name: 'Lámina ñandú', description: 'Acuarela con tilde: áéíóú ñ 🎨' }),
      productRow(2, { name: 'Taza', archivedAt: at(50) }),
      productRow(3, { name: 'Borrado', deletedAt: at(60) }),
    ],
    productVersions: [
      versionRow(1, 1, { name: 'A4', cost: clpSchema.parse(300) }),
      versionRow(2, 1, { name: 'A3', pricingMode: 'negotiable', price: null, position: 1 }),
      versionRow(3, 1, { name: 'Vieja', position: 2, archivedAt: at(40) }),
      versionRow(4, 2, {}),
      versionRow(5, 3, { deletedAt: at(60) }),
    ],
    productPhotos: [photoRow(1, 1), photoRow(2, 1, { position: 1, deletedAt: at(70) })],
    saleRecords: [
      recordRow(1, { channel: 'fair', note: 'Feria; "grande"' }),
      recordRow(2, { soldOn: localDateSchema.parse('2026-03-01') }),
      recordRow(3, { deletedAt: at(80) }),
    ],
    saleItems: [
      itemRow(1, 1, 1, 1, { unitCost: clpSchema.parse(300) }),
      itemRow(2, 1, 2, 4, { position: 1, quantity: 3 }),
      itemRow(3, 2, 1, 2, { unitPrice: clpSchema.parse(5000) }),
      itemRow(4, 1, 1, 1, { position: 2, deletedAt: at(81) }),
      itemRow(5, 3, 1, 1),
    ],
    noSalesWeeks: [noSalesWeekRow('2026-02-23')],
    tipViews: [
      { tipId: tipIdSchema.parse('primer-consejo'), firstSeenAt: at(5), updatedAt: at(6) },
    ],
  };
}
