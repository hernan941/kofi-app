import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { DataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';

import { rootKeysToInvalidate, type QueryDependency } from './root-keys-to-invalidate';

/** Props de {@link DataChangesBridge}. */
export interface DataChangesBridgeProps {
  readonly dataChanges: DataChanges;
  readonly dependencies: readonly QueryDependency[];
}

/**
 * Puente entre `DataChanges` y TanStack Query (ADR-009): reúne las tablas avisadas dentro
 * del mismo tick e invalida una sola vez cada raíz que depende de ellas. Al desmontar
 * cancela la suscripción y el vaciado pendiente. No dibuja nada.
 */
export function DataChangesBridge({ dataChanges, dependencies }: DataChangesBridgeProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const pending = new Set<TableName>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      flushTimer = undefined;
      const tables = new Set(pending);
      pending.clear();
      for (const queryKey of rootKeysToInvalidate(dependencies, tables)) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    const unsubscribe = dataChanges.subscribe((tables) => {
      for (const table of tables) {
        pending.add(table);
      }
      flushTimer ??= setTimeout(flush, 0);
    });

    return () => {
      unsubscribe();
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
      }
    };
  }, [dataChanges, dependencies, queryClient]);

  return null;
}
