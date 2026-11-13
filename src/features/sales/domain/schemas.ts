import { z } from 'zod';

import {
  clpSchema,
  localDateSchema,
  optionalTextSchema,
  productIdSchema,
  productVersionIdSchema,
  saleItemIdSchema,
} from '@/shared/domain';

import {
  QUANTITY_MAX,
  QUANTITY_MIN,
  SALE_CHANNELS,
  SALE_ITEMS_MAX,
  SALE_NOTE_MAX_LENGTH,
} from './sale';

/** Canal de venta: uno de los códigos estables. */
export const saleChannelSchema = z.enum(SALE_CHANNELS);

/** Nota: opcional, hasta 500 caracteres (D-27). */
export const saleNoteSchema = optionalTextSchema(SALE_NOTE_MAX_LENGTH);

/** Cantidad: entero de 1 a 9999. */
export const quantitySchema = z.number().int().min(QUANTITY_MIN).max(QUANTITY_MAX);

/**
 * Un ítem como lo envía el formulario. `itemId` es el id del ítem existente al editar, o
 * `null` si es nuevo. `unitPrice` es `null` cuando el usuario no lo tocó en una versión de
 * precio fijo: el dominio copia el precio de la versión. En "a convenir" es obligatorio (`0` vale).
 */
export const saleItemInputSchema = z.object({
  itemId: saleItemIdSchema.nullable(),
  productId: productIdSchema,
  productVersionId: productVersionIdSchema,
  quantity: quantitySchema,
  unitPrice: clpSchema.nullable(),
});

/** Ítem de la entrada de crear y editar. */
export type SaleItemInput = z.output<typeof saleItemInputSchema>;

/** Entrada de crear y editar. Al crear exige al menos un ítem (lo aplica `buildSaleRecord`); al editar, vacío significa borrar. */
export const saveSaleRecordInputSchema = z.object({
  soldOn: localDateSchema,
  channel: saleChannelSchema.nullable(),
  note: saleNoteSchema,
  items: z.array(saleItemInputSchema).max(SALE_ITEMS_MAX),
});

/** Entrada de crear y editar un registro de venta. */
export type SaveSaleRecordInput = z.output<typeof saveSaleRecordInputSchema>;
