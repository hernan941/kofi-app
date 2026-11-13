import { z } from 'zod';

import {
  clpSchema,
  optionalTextSchema,
  productVersionIdSchema,
  requiredTextSchema,
} from '@/shared/domain';

/** Longitud máxima del nombre de producto (D-27). */
export const PRODUCT_NAME_MAX_LENGTH = 80;
/** Longitud máxima del nombre de versión (D-27). */
export const VERSION_NAME_MAX_LENGTH = 80;
/** Longitud máxima de la descripción (D-27). */
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 1000;

/** Nombre de producto: obligatorio, recortado, hasta 80 caracteres. */
export const productNameSchema = requiredTextSchema(PRODUCT_NAME_MAX_LENGTH);
/** Descripción: opcional, hasta 1000 caracteres. */
export const productDescriptionSchema = optionalTextSchema(PRODUCT_DESCRIPTION_MAX_LENGTH);
/** Nombre de versión: opcional por campo; si es obligatorio lo decide `versionNameIssues`. */
export const versionNameSchema = optionalTextSchema(VERSION_NAME_MAX_LENGTH);

/** Precio de una versión: fijo con `Clp` (se acepta $0) o a convenir sin precio. */
export const versionPricingSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('fixed'), price: clpSchema }),
  z.object({ mode: z.literal('negotiable') }),
]);

/** Costo opcional, acotado como cualquier `Clp`; puede superar al precio. */
export const versionCostSchema = clpSchema.nullable();

/** Datos de una versión que se crea. */
export const newVersionInputSchema = z.object({
  name: versionNameSchema,
  pricing: versionPricingSchema,
  cost: versionCostSchema,
});
/** Entrada para crear una versión. */
export type NewVersionInput = z.output<typeof newVersionInputSchema>;

/** Datos de una versión existente que se edita. */
export const versionEditInputSchema = newVersionInputSchema.extend({ id: productVersionIdSchema });
/** Entrada para editar una versión existente. */
export type VersionEditInput = z.output<typeof versionEditInputSchema>;

/** Entrada de `createProduct`; al menos una versión. */
export const createProductInputSchema = z.object({
  name: productNameSchema,
  description: productDescriptionSchema,
  versions: z.array(newVersionInputSchema).min(1),
});
/** Entrada validada de `createProduct`. */
export type CreateProductInput = z.output<typeof createProductInputSchema>;

/**
 * Entrada de `updateProduct`. `versions` es la lista deseada de versiones activas, en el orden
 * de la pantalla: las que tienen `id` se editan y las que no se crean. `removedVersionIds`
 * son las versiones activas que el usuario quitó; cada una se archiva o se borra según tenga ventas.
 */
export const updateProductInputSchema = z.object({
  name: productNameSchema,
  description: productDescriptionSchema,
  versions: z.array(z.union([versionEditInputSchema, newVersionInputSchema])).min(1),
  removedVersionIds: z.array(productVersionIdSchema),
});
/** Entrada validada de `updateProduct`. */
export type UpdateProductInput = z.output<typeof updateProductInputSchema>;
