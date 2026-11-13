import { err, ok, type ProductId, type Result } from '@/shared/domain';

import { archiveProduct, unarchiveProduct, type Product, type ProductErrors } from '../domain';
import type { ProductCommandDeps } from './product-command-deps';

/** Archivar (`archived: true`) o desarchivar un producto. */
export interface SetProductArchivedCommand {
  readonly productId: ProductId;
  readonly archived: boolean;
}

function applyCommand(
  deps: ProductCommandDeps,
  current: Product,
  archived: boolean,
): Result<Product, ProductErrors> {
  return archived ? ok(archiveProduct(current, deps.clock)) : unarchiveProduct(current, deps.clock);
}

function run(
  deps: ProductCommandDeps,
  command: SetProductArchivedCommand,
): Result<void, ProductErrors> {
  const current = deps.products.findByIdSync(command.productId);
  if (current === null) {
    return err([{ code: 'product_not_found', path: [] }]);
  }
  const next = applyCommand(deps, current, command.archived);
  if (!next.ok) {
    return next;
  }
  if (next.value !== current) {
    deps.products.setArchivedSync(current.id, next.value.archivedAt, next.value.updatedAt);
  }
  return ok(undefined);
}

/** Dentro de `transactions.run`: lee, aplica `archiveProduct` o `unarchiveProduct` y escribe solo si cambió. */
export function setProductArchived(
  deps: ProductCommandDeps,
  command: SetProductArchivedCommand,
): Promise<Result<void, ProductErrors>> {
  return deps.transactions.run(() => run(deps, command));
}
