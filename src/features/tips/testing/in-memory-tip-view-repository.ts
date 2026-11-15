import type { DataChanges } from '@/core/db/data-changes';
import { runAsPromise } from '@/core/db/run-as-promise';

import type { Logger } from '@/shared/lib/logger';

import { parseTipViewRows, type StoredTipViewRow } from '../data/parse-tip-view-rows';
import type { TipViewRepository } from '../data/tip-view-repository';

/** Opciones de {@link createInMemoryTipViewRepository}. */
export interface InMemoryTipViewRepositoryOptions {
  readonly dataChanges: DataChanges;
  readonly logger: Logger;
  /** Filas ya guardadas, sin validar; sirve para probar las que tienen un id inválido. */
  readonly initialRows?: readonly StoredTipViewRow[];
}

/**
 * Doble en memoria de `TipViewRepository`. Cumple la misma suite de contrato que la
 * implementación Drizzle, descarta las filas con id inválido y emite `tip_views` en cada
 * `markSeen`.
 */
export function createInMemoryTipViewRepository({
  dataChanges,
  logger,
  initialRows = [],
}: InMemoryTipViewRepositoryOptions): TipViewRepository {
  const stored = new Map<string, StoredTipViewRow>(initialRows.map((row) => [row.tipId, row]));

  return {
    listAll: () =>
      runAsPromise(() =>
        parseTipViewRows(
          [...stored.values()].sort((a, b) => (a.tipId < b.tipId ? -1 : a.tipId > b.tipId ? 1 : 0)),
          logger,
        ),
      ),
    markSeen: (tipId, now) =>
      runAsPromise(() => {
        const current = stored.get(tipId);
        stored.set(
          tipId,
          current === undefined
            ? { tipId, firstSeenAt: now, lastSeenAt: now }
            : { ...current, lastSeenAt: now > current.lastSeenAt ? now : current.lastSeenAt },
        );
        dataChanges.emit(new Set(['tip_views']));
      }),
  };
}
