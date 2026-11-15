import type { TipCategory } from '../domain';

/** Nombre en español de cada categoría de consejos. */
export const TIP_CATEGORY_LABELS: Readonly<Record<TipCategory, string>> = {
  recording: 'Registro',
  costs: 'Costos',
  pricing: 'Precios',
  fairs: 'Ferias',
  social_media: 'Redes',
  money_flow: 'Flujo de dinero',
};
