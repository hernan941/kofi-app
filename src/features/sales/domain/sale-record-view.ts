import { coverPhoto } from '@/features/products/domain';
import type { Clp, ProductPhotoId } from '@/shared/domain';

import { recordTotal, type SaleItem, type SaleRecord } from './sale';
import type { ProductsById } from './rules';

/** Un ítem con lo que hace falta para mostrarlo con los nombres actuales del catálogo. */
export interface SaleItemView {
  readonly item: SaleItem;
  /** Nombre actual del producto; `null` si el producto ya no existe. */
  readonly productName: string | null;
  /** Nombre actual de la versión; `null` si no tiene nombre o ya no existe. */
  readonly versionName: string | null;
  /** `true` si el producto tiene más de una versión: solo entonces se muestra la versión. */
  readonly showVersion: boolean;
  /** `true` si el producto o la versión están archivados o ya no existen. */
  readonly isArchived: boolean;
  readonly coverPhotoId: ProductPhotoId | null;
}

/** Un registro listo para mostrar: ítems con nombres actuales y el total. */
export interface SaleRecordView {
  readonly record: SaleRecord;
  readonly items: readonly SaleItemView[];
  readonly total: Clp;
}

function buildItemView(item: SaleItem, products: ProductsById): SaleItemView {
  const product = products.get(item.productId);
  if (product === undefined) {
    return {
      item,
      productName: null,
      versionName: null,
      showVersion: false,
      isArchived: true,
      coverPhotoId: null,
    };
  }
  const version = product.versions.find((candidate) => candidate.id === item.productVersionId);
  return {
    item,
    productName: product.name,
    versionName: version?.name ?? null,
    showVersion: product.versions.length > 1,
    isArchived: product.archivedAt !== null || version?.archivedAt !== null,
    coverPhotoId: coverPhoto(product)?.id ?? null,
  };
}

/**
 * Arma la vista de un registro con los nombres actuales de productos y versiones (las ventas
 * pasadas muestran el nombre de hoy). Tolera productos archivados o desconocidos y registros
 * sin ítems.
 */
export function buildSaleRecordView(record: SaleRecord, products: ProductsById): SaleRecordView {
  return {
    record,
    items: record.items.map((item) => buildItemView(item, products)),
    total: recordTotal(record),
  };
}
