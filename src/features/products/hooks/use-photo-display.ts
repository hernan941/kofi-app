import { useDependencies } from '@/core/providers/dependencies-context';
import type { ProductPhotoId } from '@/shared/domain';
import type { Logger } from '@/shared/lib/logger';

const reportedMissing = new WeakMap<Logger, Set<ProductPhotoId>>();

/** What a component needs to draw a photo without seeing the ports. */
export interface PhotoDisplay {
  /** URI of the file, resolved at run time. */
  readonly uri: string;
  /** Logs `photo_file_missing` the first time the file of this photo fails to load. */
  readonly reportMissing: () => void;
}

/** URI del archivo de una foto y el registro de archivo faltante, una sola vez por foto. */
export function usePhotoDisplay(id: ProductPhotoId): PhotoDisplay {
  const { photos, logger } = useDependencies();
  return {
    uri: photos.uriFor(id),
    reportMissing: () => {
      const reported = reportedMissing.get(logger) ?? new Set<ProductPhotoId>();
      reportedMissing.set(logger, reported);
      if (!reported.has(id)) {
        reported.add(id);
        logger.warn('photo_file_missing', { id });
      }
    },
  };
}
