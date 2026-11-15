import { productListSortKey } from '@/features/products/domain';

import type { DatabaseSnapshot, SnapshotProductRow } from '../snapshot';
import { compareText } from './compare';
import { serializeCsv } from './csv-writer';

const HEADERS = ['Producto', 'Versión', 'Precio', 'Costo', 'Archivado'] as const;
const NEGOTIABLE_LABEL = 'a convenir';
const YES = 'Sí';
const NO = 'No';

function compareProducts(a: SnapshotProductRow, b: SnapshotProductRow): number {
  return (
    compareText(productListSortKey(a.name), productListSortKey(b.name)) ||
    a.createdAt - b.createdAt ||
    compareText(a.id, b.id)
  );
}

/**
 * `productos.csv` (D-10, D-44): una fila por versión no borrada de cada producto no borrado, con
 * los productos en el orden de la lista (D-31) y las versiones por `(position, id)`. Los precios
 * a convenir se escriben como "a convenir".
 */
export function buildProductsCsv(snapshot: DatabaseSnapshot): string {
  const rows: string[][] = [[...HEADERS]];
  const products = snapshot.products.filter((product) => product.deletedAt === null);
  for (const product of [...products].sort(compareProducts)) {
    const versions = snapshot.productVersions
      .filter((version) => version.productId === product.id && version.deletedAt === null)
      .sort((a, b) => a.position - b.position || compareText(a.id, b.id));
    for (const version of versions) {
      const archived = product.archivedAt !== null || version.archivedAt !== null;
      rows.push([
        product.name,
        version.name ?? '',
        version.price === null ? NEGOTIABLE_LABEL : String(version.price),
        version.cost === null ? '' : String(version.cost),
        archived ? YES : NO,
      ]);
    }
  }
  return serializeCsv(rows);
}
