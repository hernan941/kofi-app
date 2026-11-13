import type { TransactionRunner } from '@/shared/domain/transaction-runner';

import type { DataChanges } from './data-changes';
import type { AppDatabase } from './open';
import type { TableName } from './table-names';

/** Registro de las tablas modificadas dentro de una transacción. */
export interface TouchedTables {
  add(table: TableName): void;
}

/**
 * Ejecuta un bloque síncrono en una transacción. Si ya hay una transacción
 * en curso, se une a ella. Solo la transacción externa emite `DataChanges`,
 * y lo hace después del commit.
 * @param work - Bloque síncrono que recibe la transacción y registra las tablas que toca.
 * @returns El valor que devuelve el bloque.
 * @throws {Error} Re-lanza el error del bloque después del rollback.
 */
export type RunInTransaction = <T>(
  work: (tx: AppDatabase, touched: TouchedTables) => SynchronousResult<T>,
) => T;

/** Resultado permitido de un bloque transaccional: cualquier valor que no sea una promesa. */
type SynchronousResult<T> = T extends PromiseLike<unknown> ? never : T;

/** Tells whether a block result is a promise or any other thenable. */
function isThenable(value: unknown): boolean {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Runs a block and fails if it returned a thenable: a transaction must finish before the
 * block returns, so an async block would run its remaining work outside of it (ADR-006).
 * Throwing inside the block makes the outer transaction roll back.
 */
function runSynchronously<T>(work: () => SynchronousResult<T>): T {
  const result = work();
  if (isThenable(result)) {
    throw new TypeError('A transaction block must be synchronous; it returned a thenable.');
  }
  return result;
}

interface ActiveTransaction {
  readonly tx: AppDatabase;
  readonly touched: Set<TableName>;
}

/** Crea `runInTransaction` sobre `db`, que emite en `dataChanges` después de cada commit externo. */
export function createRunInTransaction(
  db: AppDatabase,
  dataChanges: DataChanges,
): RunInTransaction {
  let active: ActiveTransaction | null = null;

  return <T>(work: (tx: AppDatabase, touched: TouchedTables) => SynchronousResult<T>): T => {
    if (active) {
      const { tx, touched } = active;
      return runSynchronously<T>(() => work(tx, touched));
    }
    const touched = new Set<TableName>();
    const result = db.transaction((tx) => {
      active = { tx, touched };
      try {
        return runSynchronously<T>(() => work(tx, touched));
      } finally {
        active = null;
      }
    });
    if (touched.size > 0) {
      dataChanges.emit(touched);
    }
    return result;
  };
}

/** Adapta `runInTransaction` al puerto asíncrono `TransactionRunner` de los casos de uso. */
export function createTransactionRunner(run: RunInTransaction): TransactionRunner {
  return {
    run<T>(work: () => SynchronousResult<T>): Promise<T> {
      try {
        return Promise.resolve(run(() => work()));
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };
}
