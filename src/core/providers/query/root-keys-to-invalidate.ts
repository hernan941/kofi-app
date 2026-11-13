import type { TableName } from '@/core/db/table-names';

/** Relación entre una raíz de query keys y las tablas de las que depende (ADR-009). */
export interface QueryDependency {
  readonly rootKey: readonly [string];
  readonly tables: ReadonlySet<TableName>;
}

/**
 * Raíces de query keys que dependen de alguna de las tablas modificadas, sin repetir y en el
 * orden del registro.
 */
export function rootKeysToInvalidate(
  dependencies: readonly QueryDependency[],
  changedTables: ReadonlySet<TableName>,
): readonly (readonly [string])[] {
  return dependencies
    .filter(({ tables }) => [...changedTables].some((table) => tables.has(table)))
    .map(({ rootKey }) => rootKey);
}
