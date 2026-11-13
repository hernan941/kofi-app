import type { Logger } from '@/shared/lib/logger';

import type { TableName } from './table-names';

/** Oyente de cambios confirmados en la base. */
export type DataChangesListener = (tables: ReadonlySet<TableName>) => void;

/** Canal de avisos de cambios confirmados en la base. */
export interface DataChanges {
  /** Emite las tablas modificadas por una transacción ya confirmada. */
  emit(tables: ReadonlySet<TableName>): void;
  /**
   * Suscribe un oyente a los cambios.
   * @returns Función que cancela la suscripción.
   */
  subscribe(listener: DataChangesListener): () => void;
}

/**
 * Crea un canal de `DataChanges` en memoria. El aviso ocurre después del commit, así que un
 * oyente que lanza se aísla y se registra en `logger`: no debe verse como un fallo de la
 * escritura ya confirmada ni impedir que los demás oyentes se enteren.
 */
export function createDataChanges(logger: Logger): DataChanges {
  const listeners = new Set<DataChangesListener>();
  return {
    emit(tables) {
      for (const listener of [...listeners]) {
        try {
          listener(tables);
        } catch (error) {
          logger.error('data_changes_listener_failed', error);
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
