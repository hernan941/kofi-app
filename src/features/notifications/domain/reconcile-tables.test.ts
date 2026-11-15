import { RECONCILE_TABLES, touchesReconcileTables } from './reconcile-tables';

describe('touchesReconcileTables', () => {
  it.each(['sale_records', 'sale_items', 'no_sales_weeks', 'notification_preferences'] as const)(
    'is true when %s changes',
    (table) => {
      expect(touchesReconcileTables(new Set([table]))).toBe(true);
    },
  );

  it.each(['products', 'product_versions', 'product_photos', 'tip_views'] as const)(
    'is false when only %s changes',
    (table) => {
      expect(touchesReconcileTables(new Set([table]))).toBe(false);
    },
  );

  it('is true when a relevant table comes with others', () => {
    expect(touchesReconcileTables(new Set(['products', 'sale_items']))).toBe(true);
  });

  it('is false for an empty set and lists exactly four tables', () => {
    expect(touchesReconcileTables(new Set())).toBe(false);
    expect(RECONCILE_TABLES.size).toBe(4);
  });
});
