import { v5, v7 } from 'uuid';
import { z } from 'zod';

import type { Clock } from './calendar/clock';

/** UUID en minúsculas; fuente única de `Uuid`. */
export const uuidSchema = z
  .uuid()
  .refine((value) => value === value.toLowerCase())
  .brand<'Uuid'>();
/** UUID generado en el cliente. */
export type Uuid = z.infer<typeof uuidSchema>;

/** Id de producto: UUID con marca propia para que no se mezcle con ids de otras entidades. */
export const productIdSchema = uuidSchema.brand<'ProductId'>();
/** Identificador de producto. */
export type ProductId = z.infer<typeof productIdSchema>;

/** Id de versión de producto. */
export const productVersionIdSchema = uuidSchema.brand<'ProductVersionId'>();
/** Identificador de versión de producto. */
export type ProductVersionId = z.infer<typeof productVersionIdSchema>;

/** Id de foto de producto; determina el archivo `photos/<id>.jpg`. */
export const productPhotoIdSchema = uuidSchema.brand<'ProductPhotoId'>();
/** Identificador de foto de producto. */
export type ProductPhotoId = z.infer<typeof productPhotoIdSchema>;

/** Id de registro de venta. */
export const saleRecordIdSchema = uuidSchema.brand<'SaleRecordId'>();
/** Identificador de registro de venta. */
export type SaleRecordId = z.infer<typeof saleRecordIdSchema>;

/** Id de ítem de venta. */
export const saleItemIdSchema = uuidSchema.brand<'SaleItemId'>();
/** Identificador de ítem de venta. */
export type SaleItemId = z.infer<typeof saleItemIdSchema>;

/** Id determinista (UUIDv5) de una semana sin ventas. */
export const noSalesWeekIdSchema = uuidSchema.brand<'NoSalesWeekId'>();
/** Identificador determinista de una semana sin ventas. */
export type NoSalesWeekId = z.infer<typeof noSalesWeekIdSchema>;

/** Namespace UUIDv5 de la app para ids deterministas (ADR-006, ADR-007); no debe cambiar nunca. */
export const NAMESPACE_CUANTOVENDI = '43a7d8b3-0405-451b-a324-ddd09bf042a6';

/** Generador de identificadores, reemplazable en tests (ADR-006). */
export interface IdGenerator {
  next(): Uuid;
}

/** Fuente de bytes aleatorios; la real es `getRandomBytes` de expo-crypto (ADR-006). */
export type RandomSource = (length: 16) => Uint8Array;

/**
 * Generador UUIDv7 puro: `v7({ msecs: clock.now(), random: random(16) })` de `uuid` 14.
 * No usa `crypto.getRandomValues` global; los bytes vienen de la fuente inyectada.
 */
export function createUuidV7Generator(clock: Clock, random: RandomSource): IdGenerator {
  return {
    next: () => uuidSchema.parse(v7({ msecs: clock.now(), random: random(16) })),
  };
}

/** UUIDv5 de una clave estable con `NAMESPACE_CUANTOVENDI`; para ids deterministas (ADR-007). */
export function deterministicId(key: string): Uuid {
  return uuidSchema.parse(v5(key, NAMESPACE_CUANTOVENDI));
}
