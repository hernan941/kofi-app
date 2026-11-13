import type { UseFormSetError } from 'react-hook-form';
import { z } from 'zod';

import { activeVersions } from '@/features/products/domain';
import type { Product, ProductVersion } from '@/features/products/domain';
import {
  clpSchema,
  formatClpDigits,
  localDateSchema,
  parseClpInput,
  productIdSchema,
  productVersionIdSchema,
  saleItemIdSchema,
  type Clp,
  type LocalDate,
  type ProductId,
  type SaleRecordId,
} from '@/shared/domain';
import { clpTextSchema } from '@/shared/ui';

import {
  MAX_SALE_TOTAL,
  QUANTITY_MAX,
  QUANTITY_MIN,
  SALE_ITEMS_MAX,
  quantitySchema,
  saleChannelSchema,
  saleNoteSchema,
  type SaleChannel,
  type SaleError,
  type SaleErrorCode,
  type SaleErrors,
  type SaleRecord,
  type SaveSaleRecordInput,
} from '../domain';
import type { SaveSaleRecordCommand } from '../use-cases/save-sale-record';

/** Fila de ítem como la maneja la UI: todo como texto o número simple. */
export interface SaleItemFormValues {
  /** Id del ítem existente o `null`. No se llama `id` por la clave de `useFieldArray`. */
  readonly itemId: string | null;
  readonly productId: ProductId;
  readonly productVersionId: string;
  readonly quantity: number;
  /** Precargado con el precio fijo de la versión; vacío en "a convenir". */
  readonly priceText: string;
  /** Modo de precio de la versión elegida: define qué mensaje se muestra si el precio queda vacío. */
  readonly pricingMode: 'fixed' | 'negotiable';
}

/** Valores del formulario de venta. Los arreglos son mutables porque así lo piden RHF y su resolver. */
export interface SaleFormValues {
  readonly soldOn: LocalDate;
  readonly channel: SaleChannel | null;
  readonly note: string;
  items: SaleItemFormValues[];
}

const PRICING_MODES = ['fixed', 'negotiable'] as const;

/** Copia los problemas de un sub-esquema al contexto de la transformación, bajo `path`. */
function forwardIssues(
  issues: readonly z.core.$ZodIssue[],
  path: string,
  context: z.RefinementCtx,
): void {
  for (const issue of issues) {
    context.addIssue({
      code: 'custom',
      message: issue.message,
      path: path === '' ? [] : [path],
    });
  }
}

const NEGOTIABLE_PRICE_REQUIRED: SaleErrorCode = 'price_required';
const QUANTITY_OUT_OF_RANGE: SaleErrorCode = 'quantity_out_of_range';
const TOO_MANY_ITEMS: SaleErrorCode = 'too_many_items';

const itemRowSchema = z
  .object({
    itemId: z.string().nullable(),
    productId: z.string(),
    productVersionId: z.string(),
    quantity: z.number(),
    priceText: z.string(),
    pricingMode: z.enum(PRICING_MODES),
  })
  .transform((row, context) => {
    const quantity = quantitySchema.safeParse(row.quantity);
    const isMissingNegotiablePrice =
      row.pricingMode === 'negotiable' && row.priceText.trim() === '';
    const price = isMissingNegotiablePrice ? null : clpTextSchema.safeParse(row.priceText);
    if (!quantity.success) {
      context.addIssue({ code: 'custom', message: QUANTITY_OUT_OF_RANGE, path: ['quantity'] });
    }
    if (isMissingNegotiablePrice) {
      context.addIssue({ code: 'custom', message: NEGOTIABLE_PRICE_REQUIRED, path: ['priceText'] });
    }
    if (price && !price.success) forwardIssues(price.error.issues, 'priceText', context);
    if (!quantity.success || price?.success !== true) {
      return z.NEVER;
    }
    return {
      itemId: row.itemId === null ? null : saleItemIdSchema.parse(row.itemId),
      productId: productIdSchema.parse(row.productId),
      productVersionId: productVersionIdSchema.parse(row.productVersionId),
      quantity: quantity.data,
      unitPrice: price.data,
    };
  });

/**
 * Esquema del formulario. Convierte los textos en la entrada del dominio: el precio pasa por
 * `clpTextSchema` (obligatorio en las dos modalidades, porque en precio fijo viene precargado;
 * vacío en "a convenir" es `price_required`) y la nota por `saleNoteSchema`. Una lista de
 * ítems vacía es válida acá: crear sin ítems (`no_items`) y editar para borrar lo decide el
 * dominio. Los mensajes de los problemas son códigos que `describeSaleError` traduce.
 */
export const saleFormSchema = z.object({
  soldOn: z.custom<LocalDate>((value) => localDateSchema.safeParse(value).success),
  channel: saleChannelSchema.nullable(),
  note: z.string().transform((text, context) => {
    const parsed = saleNoteSchema.safeParse(text);
    if (!parsed.success) {
      forwardIssues(parsed.error.issues, '', context);
      return z.NEVER;
    }
    return parsed.data;
  }),
  items: z.array(itemRowSchema).max(SALE_ITEMS_MAX, { error: TOO_MANY_ITEMS }),
}) satisfies z.ZodType<SaveSaleRecordInput>;

/** Camino del ítem `index` en el arreglo de ítems del formulario. */
export function itemPath(index: number): `items.${number}` {
  return `items.${String(index)}` as `items.${number}`;
}

/** Fila nueva para un producto y versión: cantidad 1 y precio fijo precargado (sin `$`). */
export function newItemValues(product: Product, version: ProductVersion): SaleItemFormValues {
  return {
    itemId: null,
    productId: product.id,
    productVersionId: version.id,
    quantity: 1,
    priceText: version.pricing.mode === 'fixed' ? formatClpDigits(version.pricing.price) : '',
    pricingMode: version.pricing.mode,
  };
}

/** Modo de precio de la versión de un ítem guardado; `fixed` si el catálogo ya no la conoce. */
function pricingModeOf(
  record: SaleRecord['items'][number],
  catalog: ReadonlyMap<ProductId, Product>,
): SaleItemFormValues['pricingMode'] {
  const version = catalog
    .get(record.productId)
    ?.versions.find((candidate) => candidate.id === record.productVersionId);
  return version?.pricing.mode ?? 'fixed';
}

/** Un único producto vendible con una única versión activa se carga solo, para ahorrar un toque. */
function preloadedItems(sellable: readonly Product[]): SaleItemFormValues[] {
  const [only, ...others] = sellable;
  if (only === undefined || others.length > 0) {
    return [];
  }
  const [version, ...otherVersions] = activeVersions(only);
  return version === undefined || otherVersions.length > 0 ? [] : [newItemValues(only, version)];
}

/**
 * Valores iniciales. Sin registro: `soldOn = today`, sin canal ni nota y, si hay un único
 * producto vendible con una única versión, ese ítem ya cargado. Con registro: sus valores,
 * con los ítems en su orden (también los de productos archivados); `catalog` sirve para
 * saber qué ítems eran "a convenir".
 */
export function toSaleFormValues(
  record: SaleRecord | null,
  today: LocalDate,
  sellable: readonly Product[],
  catalog: ReadonlyMap<ProductId, Product> = new Map(),
): SaleFormValues {
  if (record === null) {
    return { soldOn: today, channel: null, note: '', items: preloadedItems(sellable) };
  }
  return {
    soldOn: record.soldOn,
    channel: record.channel,
    note: record.note ?? '',
    items: record.items.map((item) => ({
      itemId: item.id,
      productId: item.productId,
      productVersionId: item.productVersionId,
      quantity: item.quantity,
      priceText: formatClpDigits(item.unitPrice),
      pricingMode: pricingModeOf(item, catalog),
    })),
  };
}

/**
 * Total de las filas: Σ cantidad × precio. Ignora las filas cuyo precio o cantidad todavía no
 * son válidos, para que el total se vea mientras la persona escribe. Satura en el máximo.
 */
export function formTotal(items: readonly SaleItemFormValues[]): Clp {
  const total = items.reduce((sum, item) => {
    const price = parseClpInput(item.priceText);
    const isQuantityValid =
      Number.isInteger(item.quantity) &&
      item.quantity >= QUANTITY_MIN &&
      item.quantity <= QUANTITY_MAX;
    return price.ok && isQuantityValid ? sum + item.quantity * price.value : sum;
  }, 0);
  return clpSchema.parse(Math.min(total, MAX_SALE_TOTAL));
}

/** Total y cantidad de productos de lo que se guardó, para la celebración. */
export function outputSummary(output: SaveSaleRecordInput): {
  readonly total: Clp;
  readonly productCount: number;
} {
  const total = output.items.reduce((sum, item) => sum + item.quantity * (item.unitPrice ?? 0), 0);
  return {
    total: clpSchema.parse(Math.min(total, MAX_SALE_TOTAL)),
    productCount: output.items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

/** Convierte la salida del formulario en el comando del caso de uso. */
export function toSaveSaleRecordCommand(
  recordId: SaleRecordId | null,
  output: SaveSaleRecordInput,
): SaveSaleRecordCommand {
  return recordId === null
    ? { kind: 'create', input: output }
    : { kind: 'update', recordId, input: output };
}

type FormFieldName = Parameters<UseFormSetError<SaleFormValues>>[0];

const ITEM_FIELD_BY_DOMAIN_FIELD: Readonly<Record<string, string>> = {
  unitPrice: 'priceText',
  quantity: 'quantity',
  productId: 'productVersionId',
  productVersionId: 'productVersionId',
};

/** Campo del formulario que corresponde a un error del dominio, o `null` si no tiene campo. */
function formFieldOf(error: SaleError): string | null {
  const [head, index, field] = error.path;
  if (error.path.length === 1 && (head === 'soldOn' || head === 'note')) {
    return head;
  }
  if (error.path.length === 1 && head === 'items') {
    return 'items.root';
  }
  const itemField = typeof field === 'string' ? ITEM_FIELD_BY_DOMAIN_FIELD[field] : undefined;
  if (head === 'items' && typeof index === 'number' && itemField !== undefined) {
    return `items.${String(index)}.${itemField}`;
  }
  return null;
}

/**
 * Pone en el formulario los errores del dominio que tienen campo (`setError(path, { message:
 * code })`), con el foco en el primero, y devuelve los demás para que la pantalla los muestre
 * como aviso.
 */
export function applySaleErrors(
  errors: SaleErrors,
  setError: UseFormSetError<SaleFormValues>,
): readonly SaleError[] {
  const withoutField: SaleError[] = [];
  let isFirstFieldError = true;
  for (const error of errors) {
    const field = formFieldOf(error);
    if (field === null) {
      withoutField.push(error);
      continue;
    }
    setError(field as FormFieldName, { message: error.code }, { shouldFocus: isFirstFieldError });
    isFirstFieldError = false;
  }
  return withoutField;
}
