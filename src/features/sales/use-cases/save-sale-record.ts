import {
  err,
  isoWeekStart,
  ok,
  type LocalDate,
  type Result,
  type SaleRecordId,
} from '@/shared/domain';

import {
  buildSaleRecord,
  noSalesWeekId,
  planSaleRecordUpdate,
  type ProductsById,
  type SaleCommandContext,
  type SaleErrors,
  type SaleRecord,
  type SaveSaleRecordInput,
} from '../domain';
import type { SalesCommandDeps } from './sales-command-deps';

/** Crear o editar desde el formulario. */
export type SaveSaleRecordCommand =
  | { readonly kind: 'create'; readonly input: SaveSaleRecordInput }
  | {
      readonly kind: 'update';
      readonly recordId: SaleRecordId;
      readonly input: SaveSaleRecordInput;
    };

/** Lo que recibe la navegación posventa (punto de extensión de F6 y F7). */
export interface SaleSavedOutcome {
  readonly kind: 'created' | 'updated';
  readonly recordId: SaleRecordId;
  readonly soldOn: LocalDate;
  /** Primer registro de la historia del dispositivo, borrados incluidos; solo es `true` al crear. */
  readonly isFirstSale: boolean;
  /** Semana cuya marca de "no vendí" se quitó por D-02, o `null` si no había. */
  readonly clearedNoSalesWeek: LocalDate | null;
}

/** Resultado de guardar: guardado o, si una edición quitó todos los ítems, borrado. */
export type SaveSaleRecordResult =
  | { readonly kind: 'saved'; readonly outcome: SaleSavedOutcome }
  | { readonly kind: 'deleted'; readonly recordId: SaleRecordId };

function loadProducts(deps: SalesCommandDeps, input: SaveSaleRecordInput): ProductsById {
  const products: ProductsById = new Map(
    [...new Set(input.items.map((item) => item.productId))].flatMap((id) => {
      const product = deps.products.findByIdSync(id);
      return product === null ? [] : [[id, product] as const];
    }),
  );
  return products;
}

function clearNoSalesMark(
  deps: SalesCommandDeps,
  record: SaleRecord,
  context: SaleCommandContext,
): LocalDate | null {
  const weekStart = isoWeekStart(record.soldOn);
  return deps.noSalesWeeks.unmarkSync(noSalesWeekId(weekStart), context.now) ? weekStart : null;
}

function finish(
  deps: SalesCommandDeps,
  kind: 'created' | 'updated',
  record: SaleRecord,
  isFirstSale: boolean,
  context: SaleCommandContext,
): Result<SaveSaleRecordResult, SaleErrors> {
  return ok({
    kind: 'saved',
    outcome: {
      kind,
      recordId: record.id,
      soldOn: record.soldOn,
      isFirstSale,
      clearedNoSalesWeek: clearNoSalesMark(deps, record, context),
    },
  });
}

function create(
  deps: SalesCommandDeps,
  input: SaveSaleRecordInput,
  products: ProductsById,
  context: SaleCommandContext,
): Result<SaveSaleRecordResult, SaleErrors> {
  const isFirstSale = !deps.sales.hasAnyRecordEverSync();
  const built = buildSaleRecord(input, products, context);
  if (!built.ok) {
    return built;
  }
  deps.sales.saveSync(built.value);
  return finish(deps, 'created', built.value, isFirstSale, context);
}

function update(
  deps: SalesCommandDeps,
  recordId: SaleRecordId,
  input: SaveSaleRecordInput,
  products: ProductsById,
  context: SaleCommandContext,
): Result<SaveSaleRecordResult, SaleErrors> {
  const current = deps.sales.findByIdSync(recordId);
  if (current === null) {
    return err([{ code: 'record_not_found', path: [] }]);
  }
  const plan = planSaleRecordUpdate(current, input, products, context);
  if (!plan.ok) {
    return plan;
  }
  if (plan.value.kind === 'delete') {
    deps.sales.softDeleteSync(recordId, context.now);
    return ok({ kind: 'deleted', recordId });
  }
  if (plan.value.changed) {
    deps.sales.saveSync(plan.value.record);
  }
  return finish(deps, 'updated', plan.value.record, false, context);
}

function run(
  deps: SalesCommandDeps,
  command: SaveSaleRecordCommand,
): Result<SaveSaleRecordResult, SaleErrors> {
  const now = deps.clock.now();
  const context: SaleCommandContext = {
    now,
    today: deps.calendar.localDateOf(now),
    ids: deps.ids,
  };
  const products = loadProducts(deps, command.input);
  return command.kind === 'create'
    ? create(deps, command.input, products, context)
    : update(deps, command.recordId, command.input, products, context);
}

/**
 * Crea o edita un registro en **una** transacción: lee los productos, valida con el dominio,
 * escribe y, por D-02, quita la marca de "no vendí" de la semana de la venta. Los errores del
 * dominio se devuelven sin escribir; un fallo de un escritor revierte todo y llega como rechazo.
 * Una edición sin ítems borra el registro.
 */
export function saveSaleRecord(
  deps: SalesCommandDeps,
  command: SaveSaleRecordCommand,
): Promise<Result<SaveSaleRecordResult, SaleErrors>> {
  return deps.transactions.run(() => run(deps, command));
}
