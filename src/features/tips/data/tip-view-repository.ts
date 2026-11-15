import type { AppDatabase } from '@/core/db/open';
import type { RunInTransaction } from '@/core/db/transaction';
import type { EpochMs } from '@/shared/domain';

import type { TipId, TipView } from '../domain';

/** Consejos vistos (ADR-007: la clave primaria es el slug y no hay `deleted_at`). */
export interface TipViewRepository {
  /** Todos los consejos vistos, en orden estable por id. */
  listAll(): Promise<readonly TipView[]>;
  /**
   * Primera vez: inserta con `first_seen_at = updated_at = now`. Después: solo
   * `updated_at = max(updated_at, now)`; conserva `first_seen_at`. Siempre emite `tip_views`.
   */
  markSeen(tipId: TipId, now: EpochMs): Promise<void>;
}

/** Acceso a la base que recibe la implementación Drizzle. */
export interface TipViewDatabaseAccess {
  readonly db: () => AppDatabase;
  readonly runInTransaction: RunInTransaction;
}
