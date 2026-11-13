import type { ProductPhotoId } from '@/shared/domain';

import {
  ORPHAN_MIN_AGE_MS,
  findMissingFiles,
  findOrphans,
  type PhotoFileInfo,
} from '../domain/photos';
import type { PhotoFileDeps } from './photo-file-deps';

/** Resumen de una recolección. */
export type OrphanCollectionSummary =
  | { readonly kind: 'skipped'; readonly reason: 'lock_held' }
  | {
      readonly kind: 'done';
      readonly removedFiles: number;
      readonly removedPartials: number;
      readonly missingFiles: number;
      readonly failures: number;
    };

async function removeAll(
  ids: readonly ProductPhotoId[],
  remove: (id: ProductPhotoId) => Promise<void>,
  onFailure: (id: ProductPhotoId, error: unknown) => void,
): Promise<{ readonly removed: number; readonly failures: number }> {
  let removed = 0;
  let failures = 0;
  for (const id of ids) {
    try {
      await remove(id);
      removed += 1;
    } catch (error) {
      failures += 1;
      onFailure(id, error);
    }
  }
  return { removed, failures };
}

async function collect(deps: PhotoFileDeps): Promise<OrphanCollectionSummary> {
  const { photos, logger } = deps;
  const files: readonly PhotoFileInfo[] = await photos.listFiles();
  const partials = await photos.listPartialFiles();
  const active = await deps.products.activePhotoIds();
  const now = deps.clock.now();
  const onFailure = (id: ProductPhotoId, error: unknown) => {
    logger.error('photo_orphan_remove_failed', error, { id });
  };
  const fileResult = await removeAll(
    findOrphans(files, active, now, ORPHAN_MIN_AGE_MS),
    (id) => photos.remove(id),
    onFailure,
  );
  const partialResult = await removeAll(
    findOrphans(partials, new Set(), now, ORPHAN_MIN_AGE_MS),
    (id) => photos.removePartial(id),
    onFailure,
  );
  const missing = findMissingFiles(active, files);
  if (missing.length > 0) {
    logger.warn('photo_file_missing', { count: missing.length });
  }
  return {
    kind: 'done',
    removedFiles: fileResult.removed,
    removedPartials: partialResult.removed,
    missingFiles: missing.length,
    failures: fileResult.failures + partialResult.failures,
  };
}

/**
 * ADR-008: con `tryAcquire('orphan_collection')` (si el lock está ocupado devuelve `skipped`),
 * lista archivos y `.part`, lee `activePhotoIds`, borra los huérfanos con antigüedad mayor a
 * `ORPHAN_MIN_AGE_MS` (los `.part` con un conjunto vacío de activos), registra las filas sin
 * archivo y libera el lock en `finally`. Un error de un archivo no detiene a los demás; un
 * error de lectura se propaga como rechazo, después de liberar el lock.
 */
export async function collectOrphanPhotos(deps: PhotoFileDeps): Promise<OrphanCollectionSummary> {
  const lease = deps.fileLock.tryAcquire('orphan_collection');
  if (lease === null) {
    deps.logger.info('orphan_collection_skipped', { reason: 'lock_held' });
    return { kind: 'skipped', reason: 'lock_held' };
  }
  try {
    return await collect(deps);
  } finally {
    lease.release();
  }
}
