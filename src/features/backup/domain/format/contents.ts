import { productPhotoIdSchema, type EpochMs, type ProductPhotoId } from '@/shared/domain';

import { encodeUtf8 } from '../utf8';
import type { BackupDataV1 } from './backup-data-v1';
import { BACKUP_FORMAT, SUPPORTED_FORMAT_VERSION, type BackupManifestV1 } from './manifest';

const PHOTO_PATH = /^photos\/([0-9a-f-]{36})\.jpg$/;

/** Ruta de la entrada de una foto en el ZIP. */
export function photoEntryPath(id: ProductPhotoId): string {
  return `photos/${id}.jpg`;
}

/** Id de la foto de una ruta `photos/<id>.jpg`, o `null` si no lo es. */
export function photoIdFromEntryPath(path: string): ProductPhotoId | null {
  const match = PHOTO_PATH.exec(path);
  const parsed = productPhotoIdSchema.safeParse(match?.[1]);
  return parsed.success ? parsed.data : null;
}

/** JSON compacto codificado como UTF-8. */
export function encodeJson(value: unknown): Uint8Array {
  return encodeUtf8(JSON.stringify(value));
}

/** Datos para armar el manifiesto de un respaldo. */
export interface ManifestInput {
  readonly now: EpochMs;
  readonly appVersion: string;
  readonly data: BackupDataV1;
  readonly dataFile: { readonly byteSize: number; readonly sha256: string };
}

/**
 * Manifiesto v1: `files` lista `data.json` y una entrada por foto activa (por id ascendente);
 * los conteos excluyen las filas borradas lógicamente.
 */
export function buildManifest(input: ManifestInput): BackupManifestV1 {
  const photos = input.data.productPhotos
    .filter((photo) => photo.deletedAt === null)
    .sort((a, b) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1));
  return {
    format: BACKUP_FORMAT,
    formatVersion: SUPPORTED_FORMAT_VERSION,
    createdAt: new Date(input.now).toISOString(),
    appVersion: input.appVersion,
    counts: {
      products: input.data.products.filter((row) => row.deletedAt === null).length,
      saleRecords: input.data.saleRecords.filter((row) => row.deletedAt === null).length,
      activePhotos: photos.length,
    },
    files: [
      { path: 'data.json', ...input.dataFile },
      ...photos.map((photo) => ({
        path: photoEntryPath(photo.id),
        byteSize: photo.byteSize,
        sha256: photo.sha256,
      })),
    ],
  };
}
