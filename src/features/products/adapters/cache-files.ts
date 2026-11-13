import { Directory, File, Paths } from 'expo-file-system';

import type { Logger } from '@/shared/lib/logger';

const SWEPT_FOLDERS = ['ImagePicker', 'ImageManipulator'] as const;

function hasParentSegment(uri: string): boolean {
  return uri.split('/').some((segment) => ['..', '%2e%2e'].includes(segment.toLowerCase()));
}

/**
 * Indica si `uri` es un archivo dentro de `Paths.cache`. Rechaza otros esquemas, el propio
 * directorio y cualquier ruta con `..`, para que nunca se borre algo fuera de la caché.
 */
export function isCacheUri(uri: string): boolean {
  const cache = `${Paths.cache.uri.replace(/\/+$/, '')}/`;
  return uri.length > cache.length && uri.startsWith(cache) && !hasParentSegment(uri);
}

/**
 * Borra un temporal del selector o del manipulador si está bajo `Paths.cache`. Es el único
 * camino de borrado de temporales: una URI de otro lugar se registra y no se toca. Nunca
 * lanza; un fallo de borrado queda en el logger.
 */
export function deleteCacheFile(uri: string, logger: Logger): void {
  if (!isCacheUri(uri)) {
    logger.warn('photo_temp_outside_cache', { uri });
    return;
  }
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    logger.warn('photo_temp_cleanup_failed', { error: String(error) });
  }
}

/** Opciones de {@link sweepStaleCacheFiles}. */
export interface SweepOptions {
  readonly now: number;
  /** Antigüedad mínima; un archivo exactamente en el límite no se borra. */
  readonly minAgeMs: number;
}

/**
 * Barre `Paths.cache/ImagePicker/` e `ImageManipulator/` y borra los archivos con más de
 * `minAgeMs` de antigüedad: son temporales que dejó un proceso cerrado antes de limpiar
 * (por ejemplo, una captura de cámara pendiente). Devuelve cuántos borró.
 */
export function sweepStaleCacheFiles(logger: Logger, options: SweepOptions): number {
  let removed = 0;
  for (const name of SWEPT_FOLDERS) {
    const directory = new Directory(Paths.cache, name);
    if (!directory.exists) {
      continue;
    }
    for (const entry of directory.list()) {
      if (!(entry instanceof File) || entry.lastModified === null) {
        continue;
      }
      if (options.now - entry.lastModified > options.minAgeMs) {
        deleteCacheFile(entry.uri, logger);
        if (!entry.exists) {
          removed += 1;
        }
      }
    }
  }
  return removed;
}
