/**
 * Frontera asíncrona de una transacción que abarca varios repositorios.
 * `work` es síncrono (ADR-006): el tipo rechaza un bloque que devuelva una promesa.
 * Un error dentro de `work` hace rollback y llega como promesa rechazada.
 * Emite `DataChanges` una sola vez, después del commit.
 */
export interface TransactionRunner {
  run<T>(work: () => T extends PromiseLike<unknown> ? never : T): Promise<T>;
}
