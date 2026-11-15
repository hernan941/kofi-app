import type { SaleChannel } from '@/features/sales/domain';

import type { DatabaseSnapshot, SnapshotSaleItemRow, SnapshotSaleRecordRow } from '../snapshot';
import { serializeCsv } from './csv-writer';
import { compareText } from './compare';

const HEADERS = [
  'Fecha',
  'Registro',
  'Producto',
  'Versión',
  'Cantidad',
  'Precio unitario',
  'Subtotal',
  'Dónde vendiste',
  'Nota',
] as const;

function compareRecords(a: SnapshotSaleRecordRow, b: SnapshotSaleRecordRow): number {
  return compareText(a.soldOn, b.soldOn) || a.createdAt - b.createdAt || compareText(a.id, b.id);
}

function compareItems(a: SnapshotSaleItemRow, b: SnapshotSaleItemRow): number {
  return a.position - b.position || compareText(a.id, b.id);
}

/**
 * `ventas.csv` (D-10, D-44): una fila por ítem activo de cada registro activo, sin costos.
 * Ordena por `(soldOn, createdAt, id)` del registro y después por `(position, id)` del ítem.
 * Las etiquetas de canal llegan como parámetro para que el dominio no dependa de la UI.
 */
export function buildSalesCsv(
  snapshot: DatabaseSnapshot,
  channelLabels: Readonly<Record<SaleChannel, string>>,
): string {
  const productNames = new Map(snapshot.products.map((product) => [product.id, product.name]));
  const versionNames = new Map(
    snapshot.productVersions.map((version) => [version.id, version.name ?? '']),
  );
  const rows: string[][] = [[...HEADERS]];
  const records = snapshot.saleRecords.filter((record) => record.deletedAt === null);
  for (const record of [...records].sort(compareRecords)) {
    const items = snapshot.saleItems.filter(
      (item) => item.saleRecordId === record.id && item.deletedAt === null,
    );
    for (const item of [...items].sort(compareItems)) {
      rows.push([
        record.soldOn,
        record.id,
        productNames.get(item.productId) ?? '',
        versionNames.get(item.productVersionId) ?? '',
        String(item.quantity),
        String(item.unitPrice),
        String(item.quantity * item.unitPrice),
        record.channel === null ? '' : channelLabels[record.channel],
        record.note ?? '',
      ]);
    }
  }
  return serializeCsv(rows);
}
