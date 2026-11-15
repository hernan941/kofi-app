import { z } from 'zod';

import { SALE_CHANNELS } from '@/features/sales/domain';
import { tipIdSchema } from '@/features/tips/domain';
import {
  clpSchema,
  epochMsSchema,
  isoWeekday,
  localDateSchema,
  noSalesWeekIdSchema,
  productIdSchema,
  productPhotoIdSchema,
  productVersionIdSchema,
  saleItemIdSchema,
  saleRecordIdSchema,
} from '@/shared/domain';

const NAME_MAX = 80;
const DESCRIPTION_MAX = 1000;
const NOTE_MAX = 500;
const QUANTITY_MAX = 9999;
const MONDAY = 1;

const nameSchema = z.string().min(1).max(NAME_MAX);
const positionSchema = z.number().int().min(0);
const positiveIntSchema = z.number().int().min(1);
const nullableEpochMs = epochMsSchema.nullable();
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const weekStartSchema = localDateSchema.refine((value) => isoWeekday(value) === MONDAY);

const productSchema = z.strictObject({
  id: productIdSchema,
  name: nameSchema,
  description: z.string().max(DESCRIPTION_MAX).nullable(),
  archivedAt: nullableEpochMs,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  deletedAt: nullableEpochMs,
});

const productVersionSchema = z
  .strictObject({
    id: productVersionIdSchema,
    productId: productIdSchema,
    name: z.string().max(NAME_MAX).nullable(),
    pricingMode: z.enum(['fixed', 'negotiable']),
    price: clpSchema.nullable(),
    cost: clpSchema.nullable(),
    position: positionSchema,
    archivedAt: nullableEpochMs,
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
    deletedAt: nullableEpochMs,
  })
  .refine((version) => (version.pricingMode === 'fixed') === (version.price !== null), {
    path: ['price'],
  });

const productPhotoSchema = z.strictObject({
  id: productPhotoIdSchema,
  productId: productIdSchema,
  position: positionSchema,
  width: positiveIntSchema,
  height: positiveIntSchema,
  byteSize: positiveIntSchema,
  sha256: sha256Schema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  deletedAt: nullableEpochMs,
});

const saleRecordSchema = z.strictObject({
  id: saleRecordIdSchema,
  soldOn: localDateSchema,
  channel: z.enum(SALE_CHANNELS).nullable(),
  note: z.string().max(NOTE_MAX).nullable(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  deletedAt: nullableEpochMs,
});

const saleItemSchema = z.strictObject({
  id: saleItemIdSchema,
  saleRecordId: saleRecordIdSchema,
  productId: productIdSchema,
  productVersionId: productVersionIdSchema,
  quantity: z.number().int().min(1).max(QUANTITY_MAX),
  unitPrice: clpSchema,
  unitCost: clpSchema.nullable(),
  position: positionSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  deletedAt: nullableEpochMs,
});

const noSalesWeekSchema = z.strictObject({
  id: noSalesWeekIdSchema,
  weekStart: weekStartSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  deletedAt: nullableEpochMs,
});

const tipViewSchema = z.strictObject({
  tipId: tipIdSchema,
  firstSeenAt: epochMsSchema,
  updatedAt: epochMsSchema,
});

/** Esquema *strict* de `data.json` v1: contrato público y congelado (ADR-012, ADR-010). */
export const backupDataV1Schema = z.strictObject({
  products: z.array(productSchema),
  productVersions: z.array(productVersionSchema),
  productPhotos: z.array(productPhotoSchema),
  saleRecords: z.array(saleRecordSchema),
  saleItems: z.array(saleItemSchema),
  noSalesWeeks: z.array(noSalesWeekSchema),
  tipViews: z.array(tipViewSchema),
});

/** Lo que se exporta en `data.json`; contrato público y congelado de la versión 1. */
export type BackupDataV1 = z.infer<typeof backupDataV1Schema>;
/** Producto en `data.json` v1. */
export type BackupProductV1 = z.infer<typeof productSchema>;
/** Versión de producto en `data.json` v1. */
export type BackupProductVersionV1 = z.infer<typeof productVersionSchema>;
/** Foto en `data.json` v1. */
export type BackupProductPhotoV1 = z.infer<typeof productPhotoSchema>;
/** Registro de venta en `data.json` v1. */
export type BackupSaleRecordV1 = z.infer<typeof saleRecordSchema>;
/** Ítem de venta en `data.json` v1. */
export type BackupSaleItemV1 = z.infer<typeof saleItemSchema>;
/** Semana sin ventas en `data.json` v1. */
export type BackupNoSalesWeekV1 = z.infer<typeof noSalesWeekSchema>;
/** Consejo visto en `data.json` v1. */
export type BackupTipViewV1 = z.infer<typeof tipViewSchema>;
