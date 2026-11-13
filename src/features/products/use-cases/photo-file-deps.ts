import type { Clock } from '@/shared/domain';
import type { FileLock } from '@/shared/domain/file-lock';
import type { Logger } from '@/shared/lib/logger';

import type { ProductRepository } from '../data/product-repository';
import type { PhotoStorage } from '../domain';

/** Puertos de las operaciones sobre archivos de fotos. */
export interface PhotoFileDeps {
  readonly photos: PhotoStorage;
  readonly products: Pick<ProductRepository, 'activePhotoIds'>;
  readonly fileLock: FileLock;
  readonly clock: Clock;
  readonly logger: Logger;
}
