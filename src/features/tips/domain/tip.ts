import { z } from 'zod';

import type { EpochMs } from '@/shared/domain';

/** Categorías del contenido aprobado; los textos en español viven en la UI. */
export const TIP_CATEGORIES = [
  'recording',
  'costs',
  'pricing',
  'fairs',
  'social_media',
  'money_flow',
] as const;

/** Categoría de un consejo. */
export type TipCategory = (typeof TIP_CATEGORIES)[number];

/** Situaciones en las que un consejo tiene prioridad después de una venta. */
export const TIP_TRIGGERS = [
  'no_costs',
  'first_sale',
  'streak',
  'no_channel',
  'fair_sale',
] as const;

/** Situación que da prioridad a un consejo. */
export type TipTrigger = (typeof TIP_TRIGGERS)[number];

/** Slug estable en kebab-case; `tip_views` lo referencia y no cambia nunca. */
export const tipIdSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .brand<'TipId'>();

/** Identificador estable de un consejo. */
export type TipId = z.infer<typeof tipIdSchema>;

/** Largo máximo del título de un consejo. */
export const TIP_TITLE_MAX_LENGTH = 50;
/** Largo máximo del cuerpo de un consejo. */
export const TIP_BODY_MAX_LENGTH = 240;

/** Consejo del catálogo incluido en la app. */
export interface Tip {
  readonly id: TipId;
  readonly category: TipCategory;
  readonly title: string;
  readonly body: string;
  /** Contexto en el que tiene prioridad; `null` si no tiene. */
  readonly trigger: TipTrigger | null;
}

/** Fuente de consejos; hoy incluida en la app, en el futuro remota (ADR-007). */
export interface TipCatalog {
  all(): readonly Tip[];
}

/** Lo que se sabe de un consejo ya visto. */
export interface TipView {
  readonly tipId: TipId;
  readonly firstSeenAt: EpochMs;
  /** Última vez que se mostró (`tip_views.updated_at`). */
  readonly lastSeenAt: EpochMs;
}
