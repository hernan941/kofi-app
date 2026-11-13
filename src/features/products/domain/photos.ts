import {
  err,
  ok,
  type Clock,
  type EpochMs,
  type ProductPhotoId,
  type Result,
} from '@/shared/domain';

import type { ProductError, ProductErrors } from './errors';
import { toProductErrors } from './errors';
import type { Product, ProductPhoto } from './product';

/** Máximo de fotos activas por producto (D-05). */
export const MAX_PHOTOS_PER_PRODUCT = 6;
/** Lado mayor de una foto guardada, en píxeles (ADR-008). */
export const PHOTO_MAX_SIDE = 1600;
/** Calidad JPEG de la recompresión (ADR-008). */
export const PHOTO_JPEG_COMPRESS = 0.8;
/** Antigüedad mínima para borrar un archivo sin fila activa (ADR-008). */
export const ORPHAN_MIN_AGE_MS = 15 * 60 * 1000;

/** Resultado de importar una foto ya procesada y guardada (ADR-008); no hay nombre de archivo (ADR-007). */
export interface StoredPhoto {
  readonly id: ProductPhotoId;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
  readonly sha256: string;
}

/** Archivo presente en la carpeta de fotos, con su fecha de modificación (ADR-008). */
export interface PhotoFileInfo {
  readonly id: ProductPhotoId;
  readonly modifiedAt: EpochMs;
}

/**
 * Lista deseada de fotos del producto, en orden de pantalla (la primera es la portada).
 * Cada entrada es una foto existente del producto o una recién importada.
 */
export type PhotoChangesInput = readonly StoredPhoto[];

/** Diferencia por id entre las fotos guardadas y las nuevas; sin cambios, las tres listas van vacías. */
export interface PhotoDiff {
  readonly inserted: readonly ProductPhoto[];
  readonly moved: readonly { readonly id: ProductPhotoId; readonly position: number }[];
  readonly removed: readonly ProductPhotoId[];
}

/** Tamaño de salida que entra en `maxSide` conservando la proporción; nunca agranda. Redondea al entero más cercano y no baja de 1. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number,
): { readonly width: number; readonly height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Cupo que queda: `max(0, MAX_PHOTOS_PER_PRODUCT - activeCount)`. */
export function remainingPhotoSlots(activeCount: number): number {
  return Math.max(0, MAX_PHOTOS_PER_PRODUCT - activeCount);
}

/** Recorta una selección al cupo; devuelve lo que se conserva y lo que sobra (para borrar sus temporales). */
export function fitSelection<T>(
  selected: readonly T[],
  remaining: number,
): { readonly kept: readonly T[]; readonly dropped: readonly T[] } {
  const slots = Math.max(0, remaining);
  return { kept: selected.slice(0, slots), dropped: selected.slice(slots) };
}

/** ADR-008: archivos sin fila activa y con `now - modifiedAt > minAgeMs`. El límite exacto (igual a `minAgeMs`) no se borra. */
export function findOrphans(
  files: readonly PhotoFileInfo[],
  activeIds: ReadonlySet<ProductPhotoId>,
  now: EpochMs,
  minAgeMs: number,
): readonly ProductPhotoId[] {
  return files
    .filter((file) => !activeIds.has(file.id) && now - file.modifiedAt > minAgeMs)
    .map((file) => file.id);
}

/** Ids con fila activa que no tienen archivo; se registran en el logger (ADR-008). */
export function findMissingFiles(
  activeIds: ReadonlySet<ProductPhotoId>,
  files: readonly PhotoFileInfo[],
): readonly ProductPhotoId[] {
  const present = new Set(files.map((file) => file.id));
  return [...activeIds].filter((id) => !present.has(id));
}

/** Fotos ordenadas por `(position, id)`; tolera posiciones repetidas o con huecos (ADR-007, regla 15). */
export function orderedPhotos(photos: readonly ProductPhoto[]): readonly ProductPhoto[] {
  return [...photos].sort(
    (a, b) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Portada (D-17): la primera de `orderedPhotos`, o `null` si no hay fotos. */
export function coverPhoto(product: Pick<Product, 'photos'>): ProductPhoto | null {
  return orderedPhotos(product.photos)[0] ?? null;
}

/** Mueve la foto `id` a `toIndex` (acotado al rango) y devuelve la lista nueva; sin efecto si el id no está. */
export function movePhoto<T extends { readonly id: ProductPhotoId }>(
  photos: readonly T[],
  id: ProductPhotoId,
  toIndex: number,
): readonly T[] {
  const from = photos.findIndex((photo) => photo.id === id);
  const moving = photos[from];
  if (moving === undefined) {
    return photos;
  }
  const rest = photos.filter((_, index) => index !== from);
  const target = Math.min(Math.max(0, toIndex), rest.length);
  return [...rest.slice(0, target), moving, ...rest.slice(target)];
}

/** Atajo de D-17: mueve la foto a la posición 0. */
export function makeCover<T extends { readonly id: ProductPhotoId }>(
  photos: readonly T[],
  id: ProductPhotoId,
): readonly T[] {
  return movePhoto(photos, id, 0);
}

function photoIssues(desired: PhotoChangesInput): readonly ProductError[] {
  const issues: ProductError[] = [];
  if (desired.length > MAX_PHOTOS_PER_PRODUCT) {
    issues.push({ code: 'too_many_photos', path: ['photos'] });
  }
  const seen = new Set<ProductPhotoId>();
  desired.forEach((photo, index) => {
    if (seen.has(photo.id)) {
      issues.push({ code: 'duplicate_photo', path: ['photos', index] });
    }
    seen.add(photo.id);
  });
  return issues;
}

function samePhoto(a: ProductPhoto, b: ProductPhoto): boolean {
  return (
    a.id === b.id &&
    a.productId === b.productId &&
    a.position === b.position &&
    a.width === b.width &&
    a.height === b.height &&
    a.byteSize === b.byteSize &&
    a.sha256 === b.sha256
  );
}

function samePhotos(a: readonly ProductPhoto[], b: readonly ProductPhoto[]): boolean {
  return (
    a.length === b.length &&
    a.every((photo, index) => {
      const other = b[index];
      return other !== undefined && samePhoto(photo, other);
    })
  );
}

/**
 * Aplica la lista deseada al producto:
 * - las existentes que no están en la lista se quitan (dejan de estar en `photos`);
 * - las nuevas reciben `productId` del producto;
 * - las posiciones quedan `0..n-1` en el orden recibido;
 * - `updatedAt` pasa a `clock.now()` solo si algo cambió.
 *
 * Errores: `too_many_photos` (más de 6, ruta `['photos']`) y `duplicate_photo` (id repetido,
 * ruta `['photos', i]`). Un id existente con metadatos distintos de la fila conserva los de
 * la fila: las fotos son inmutables (ADR-008).
 */
export function setProductPhotos(
  current: Product,
  desired: PhotoChangesInput,
  clock: Clock,
): Result<Product, ProductErrors> {
  const errors = toProductErrors(photoIssues(desired));
  if (errors !== null) {
    return err(errors);
  }
  const existing = new Map(current.photos.map((photo) => [photo.id, photo]));
  const photos = desired.map((photo, position): ProductPhoto => {
    const row = existing.get(photo.id);
    return row === undefined ? { ...photo, productId: current.id, position } : { ...row, position };
  });
  if (samePhotos(orderedPhotos(current.photos), photos)) {
    return ok(current);
  }
  return ok({ ...current, photos, updatedAt: clock.now() });
}

/** Calcula el `PhotoDiff` entre dos listas de fotos del mismo producto. */
export function diffPhotos(
  before: readonly ProductPhoto[],
  after: readonly ProductPhoto[],
): PhotoDiff {
  const previous = new Map(before.map((photo) => [photo.id, photo]));
  const kept = new Set(after.map((photo) => photo.id));
  return {
    inserted: after.filter((photo) => !previous.has(photo.id)),
    moved: after
      .filter((photo) => {
        const old = previous.get(photo.id);
        return old !== undefined && old.position !== photo.position;
      })
      .map((photo) => ({ id: photo.id, position: photo.position })),
    removed: before.filter((photo) => !kept.has(photo.id)).map((photo) => photo.id),
  };
}
