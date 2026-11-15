/**
 * Tablas cuyo cambio puede alterar el plan de notificaciones: la semana registrada (ventas,
 * ítems y marcas de "no vendí") y las preferencias. Los nombres son los de la base; el dominio
 * no importa el tipo de `core`.
 */
export const RECONCILE_TABLES: ReadonlySet<string> = new Set([
  'sale_records',
  'sale_items',
  'no_sales_weeks',
  'notification_preferences',
]);

/** Indica si alguna de las tablas modificadas obliga a reconciliar. */
export function touchesReconcileTables(tables: ReadonlySet<string>): boolean {
  for (const table of tables) {
    if (RECONCILE_TABLES.has(table)) {
      return true;
    }
  }
  return false;
}
