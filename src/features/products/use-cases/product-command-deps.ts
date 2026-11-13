import type { Clock, IdGenerator } from '@/shared/domain';
import type { FileLock } from '@/shared/domain/file-lock';
import type { TransactionRunner } from '@/shared/domain/transaction-runner';
import type { Logger } from '@/shared/lib/logger';

import type { ProductWriter } from '../data/product-repository';
import type { PhotoStorage } from '../domain';

/** Puertos de los casos de uso de productos (F1 y F2). */
export interface ProductCommandDeps {
  readonly transactions: TransactionRunner;
  readonly products: ProductWriter;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly photos: PhotoStorage;
  readonly fileLock: FileLock;
  readonly logger: Logger;
}
