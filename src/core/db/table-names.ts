/** Nombres de las tablas de la base, en el orden del esquema (ADR-009). */
export const TABLE_NAMES = [
  'products',
  'product_versions',
  'product_photos',
  'sale_records',
  'sale_items',
  'no_sales_weeks',
  'tip_views',
  'notification_preferences',
] as const;

/** Nombre de tabla de la base, tomado del esquema Drizzle. */
export type TableName = (typeof TABLE_NAMES)[number];
