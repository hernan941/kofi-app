import { asc, sql } from 'drizzle-orm';

import { runAsPromise } from '@/core/db/run-as-promise';
import { tipViews } from '@/core/db/schema/tip-views';

import type { Logger } from '@/shared/lib/logger';

import { parseTipViewRows } from './parse-tip-view-rows';
import type { TipViewDatabaseAccess, TipViewRepository } from './tip-view-repository';

/** Acceso a la base y logger que recibe {@link createDrizzleTipViewRepository}. */
export interface DrizzleTipViewRepositoryOptions extends TipViewDatabaseAccess {
  readonly logger: Logger;
}

/**
 * Implementación Drizzle de {@link TipViewRepository}. `markSeen` es un solo upsert: la
 * primera vez inserta y las siguientes solo avanzan `updated_at`, sin tocar `first_seen_at`.
 * `listAll` descarta (y registra) las filas con un id inválido en vez de fallar.
 */
export function createDrizzleTipViewRepository(
  access: DrizzleTipViewRepositoryOptions,
): TipViewRepository {
  return {
    listAll: () =>
      runAsPromise(() =>
        parseTipViewRows(
          access
            .db()
            .select()
            .from(tipViews)
            .orderBy(asc(tipViews.tipId))
            .all()
            .map((row) => ({
              tipId: row.tipId,
              firstSeenAt: row.firstSeenAt,
              lastSeenAt: row.updatedAt,
            })),
          access.logger,
        ),
      ),
    markSeen: (tipId, now) =>
      runAsPromise(() => {
        access.runInTransaction((tx, touched) => {
          tx.insert(tipViews)
            .values({ tipId, firstSeenAt: now, updatedAt: now })
            .onConflictDoUpdate({
              target: tipViews.tipId,
              set: { updatedAt: sql`max(${tipViews.updatedAt}, excluded.updated_at)` },
            })
            .run();
          touched.add('tip_views');
        });
      }),
  };
}
