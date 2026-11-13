import { err, ok, type Result, type SaleRecordId } from '@/shared/domain';

import type { SaleErrors } from '../domain';
import type { SalesCommandDeps } from './sales-command-deps';

/**
 * Borrado lógico del registro y sus ítems (D-04; la confirmación la hace la UI). No crea ni
 * restaura marcas. `record_not_found` si no existe o ya estaba borrado.
 */
export function deleteSaleRecord(
  deps: SalesCommandDeps,
  recordId: SaleRecordId,
): Promise<Result<void, SaleErrors>> {
  return deps.transactions.run(() =>
    deps.sales.softDeleteSync(recordId, deps.clock.now())
      ? ok(undefined)
      : err([{ code: 'record_not_found', path: [] }] as const),
  );
}
