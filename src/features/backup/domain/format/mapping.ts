import type { DatabaseSnapshot } from '../snapshot';
import type { BackupDataV1 } from './backup-data-v1';

function byId<T extends { readonly id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1));
}

function byTipId<T extends { readonly tipId: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.tipId === b.tipId ? 0 : a.tipId < b.tipId ? -1 : 1));
}

/** Snapshot → `data.json` v1, campo por campo, con cada colección ordenada por id (JSON determinista). */
export function snapshotToBackupData(snapshot: DatabaseSnapshot): BackupDataV1 {
  return {
    products: byId(snapshot.products).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    })),
    productVersions: byId(snapshot.productVersions).map((row) => ({
      id: row.id,
      productId: row.productId,
      name: row.name,
      pricingMode: row.pricingMode,
      price: row.price,
      cost: row.cost,
      position: row.position,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    })),
    productPhotos: byId(snapshot.productPhotos).map((row) => ({
      id: row.id,
      productId: row.productId,
      position: row.position,
      width: row.width,
      height: row.height,
      byteSize: row.byteSize,
      sha256: row.sha256,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    })),
    saleRecords: byId(snapshot.saleRecords).map((row) => ({
      id: row.id,
      soldOn: row.soldOn,
      channel: row.channel,
      note: row.note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    })),
    saleItems: byId(snapshot.saleItems).map((row) => ({
      id: row.id,
      saleRecordId: row.saleRecordId,
      productId: row.productId,
      productVersionId: row.productVersionId,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      unitCost: row.unitCost,
      position: row.position,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    })),
    noSalesWeeks: byId(snapshot.noSalesWeeks).map((row) => ({
      id: row.id,
      weekStart: row.weekStart,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    })),
    tipViews: byTipId(snapshot.tipViews).map((row) => ({
      tipId: row.tipId,
      firstSeenAt: row.firstSeenAt,
      updatedAt: row.updatedAt,
    })),
  };
}

/** `data.json` v1 → snapshot, campo por campo; es la inversa de `snapshotToBackupData`. */
export function backupDataToSnapshot(data: BackupDataV1): DatabaseSnapshot {
  return {
    products: data.products.map((row) => ({ ...row })),
    productVersions: data.productVersions.map((row) => ({ ...row })),
    productPhotos: data.productPhotos.map((row) => ({ ...row })),
    saleRecords: data.saleRecords.map((row) => ({ ...row })),
    saleItems: data.saleItems.map((row) => ({ ...row })),
    noSalesWeeks: data.noSalesWeeks.map((row) => ({ ...row })),
    tipViews: data.tipViews.map((row) => ({ ...row })),
  };
}
