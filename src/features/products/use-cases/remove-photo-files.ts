import type { ProductPhotoId } from '@/shared/domain';

import type { PhotoFileDeps } from './photo-file-deps';

async function deleteInactive(deps: PhotoFileDeps, ids: readonly ProductPhotoId[]): Promise<void> {
  const lease = deps.fileLock.tryAcquire('photo_removal');
  if (lease === null) {
    deps.fileLock.whenReleased(() => {
      void deleteInactive(deps, ids);
    });
    return;
  }
  try {
    const active = await deps.products.activePhotoIds();
    for (const id of ids.filter((candidate) => !active.has(candidate))) {
      try {
        await deps.photos.remove(id);
      } catch (error) {
        deps.logger.error('photo_file_remove_failed', error, { id });
      }
    }
  } catch (error) {
    deps.logger.error('photo_file_removal_failed', error);
  } finally {
    lease.release();
  }
}

/**
 * Borra los archivos de `ids` que no tienen fila activa. Toma el lock como `photo_removal`;
 * si está ocupado, se reprograma con `whenReleased` y resuelve enseguida. Vuelve a leer
 * `activePhotoIds` justo antes de borrar: una restauración pudo haber reactivado ese id
 * (ADR-012). Nunca rechaza; registra cada falla.
 */
export async function removePhotoFiles(
  deps: PhotoFileDeps,
  ids: readonly ProductPhotoId[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await deleteInactive(deps, ids);
}
