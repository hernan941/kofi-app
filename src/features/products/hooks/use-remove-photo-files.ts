import { useCallback } from 'react';

import { useDependencies } from '@/core/providers/dependencies-context';
import type { ProductPhotoId } from '@/shared/domain';

import { removePhotoFiles } from '../use-cases/remove-photo-files';

/**
 * Returns the function that deletes photo files that no longer have an active row. The
 * form uses it for the photos that were imported and never saved (removed, or left behind
 * when the person leaves without saving). It never rejects.
 */
export function useRemovePhotoFiles(): (ids: readonly ProductPhotoId[]) => Promise<void> {
  const { photos, products, fileLock, clock, logger } = useDependencies();
  return useCallback(
    (ids) => removePhotoFiles({ photos, products, fileLock, clock, logger }, ids),
    [photos, products, fileLock, clock, logger],
  );
}
