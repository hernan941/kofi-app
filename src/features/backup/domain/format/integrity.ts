import { noSalesWeekId } from '@/features/sales/domain';
import { err, ok, type Result } from '@/shared/domain';

import type { RestoreError } from '../errors';
import type { BackupDataV1 } from './backup-data-v1';
import { photoIdFromEntryPath } from './contents';
import type { BackupManifestV1 } from './manifest';

const invalid = (...issues: string[]): RestoreError => ({ code: 'invalid_data', issues });
const BROKEN: RestoreError = { code: 'broken_references' };

function duplicateIssue(name: string, ids: readonly string[]): string | null {
  return new Set(ids).size === ids.length ? null : `${name}.id`;
}

function firstDuplicate(data: BackupDataV1): string | null {
  const checks = [
    duplicateIssue(
      'products',
      data.products.map((row) => row.id),
    ),
    duplicateIssue(
      'productVersions',
      data.productVersions.map((row) => row.id),
    ),
    duplicateIssue(
      'productPhotos',
      data.productPhotos.map((row) => row.id),
    ),
    duplicateIssue(
      'saleRecords',
      data.saleRecords.map((row) => row.id),
    ),
    duplicateIssue(
      'saleItems',
      data.saleItems.map((row) => row.id),
    ),
    duplicateIssue(
      'noSalesWeeks',
      data.noSalesWeeks.map((row) => row.id),
    ),
    new Set(data.noSalesWeeks.map((row) => row.weekStart)).size === data.noSalesWeeks.length
      ? null
      : 'noSalesWeeks.weekStart',
    new Set(data.tipViews.map((row) => row.tipId)).size === data.tipViews.length
      ? null
      : 'tipViews.tipId',
  ];
  return checks.find((issue) => issue !== null) ?? null;
}

function hasBrokenReferences(data: BackupDataV1): boolean {
  const products = new Set(data.products.map((row) => row.id));
  const records = new Set(data.saleRecords.map((row) => row.id));
  const versionProduct = new Map(data.productVersions.map((row) => [row.id, row.productId]));
  return (
    data.productVersions.some((row) => !products.has(row.productId)) ||
    data.productPhotos.some((row) => !products.has(row.productId)) ||
    data.saleItems.some(
      (item) =>
        !records.has(item.saleRecordId) ||
        !products.has(item.productId) ||
        versionProduct.get(item.productVersionId) !== item.productId,
    )
  );
}

function activeCount(rows: readonly { readonly deletedAt: unknown }[]): number {
  return rows.filter((row) => row.deletedAt === null).length;
}

/**
 * Integridad: ids únicos por tabla (`invalid_data`); versiones, fotos e ítems con padres
 * existentes y versión del ítem del mismo producto (`broken_references`); `noSalesWeeks.id` igual
 * a `noSalesWeekId(weekStart)` y `counts` del manifiesto iguales a los calculados (`invalid_data`).
 */
export function checkIntegrity(
  data: BackupDataV1,
  manifest: BackupManifestV1,
): Result<void, RestoreError> {
  const duplicate = firstDuplicate(data);
  if (duplicate !== null) {
    return err(invalid(duplicate));
  }
  if (hasBrokenReferences(data)) {
    return err(BROKEN);
  }
  if (data.noSalesWeeks.some((week) => week.id !== noSalesWeekId(week.weekStart))) {
    return err(invalid('noSalesWeeks.id'));
  }
  const { counts } = manifest;
  if (counts.products !== activeCount(data.products)) {
    return err(invalid('counts.products'));
  }
  if (counts.saleRecords !== activeCount(data.saleRecords)) {
    return err(invalid('counts.saleRecords'));
  }
  if (counts.activePhotos !== activeCount(data.productPhotos)) {
    return err(invalid('counts.activePhotos'));
  }
  return ok(undefined);
}

/**
 * Cada foto activa tiene exactamente un archivo `photos/<id>.jpg` en `manifest.files`, con su
 * mismo `byteSize` y `sha256`; las borradas no tienen archivo y un archivo sin foto activa es
 * error (`broken_references`). `files` debe tener `data.json` una vez y nada más (`invalid_data`).
 */
export function checkPhotoFiles(
  data: BackupDataV1,
  manifest: BackupManifestV1,
): Result<void, RestoreError> {
  const paths = manifest.files.map((file) => file.path);
  if (new Set(paths).size !== paths.length) {
    return err(invalid('files.path'));
  }
  const photoFiles = new Map<string, (typeof manifest.files)[number]>();
  let dataFiles = 0;
  for (const file of manifest.files) {
    if (file.path === 'data.json') {
      dataFiles += 1;
    } else if (photoIdFromEntryPath(file.path) !== null) {
      photoFiles.set(file.path, file);
    } else {
      return err(invalid('files.path'));
    }
  }
  if (dataFiles !== 1) {
    return err(invalid('files.path'));
  }
  const active = data.productPhotos.filter((photo) => photo.deletedAt === null);
  if (active.length !== photoFiles.size) {
    return err(BROKEN);
  }
  for (const photo of active) {
    const file = photoFiles.get(`photos/${photo.id}.jpg`);
    if (file?.byteSize !== photo.byteSize || file.sha256 !== photo.sha256) {
      return err(BROKEN);
    }
  }
  return ok(undefined);
}
