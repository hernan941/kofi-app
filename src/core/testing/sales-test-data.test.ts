import { createTestDependencies } from './create-test-dependencies';
import { seedNoSalesWeek, seedSale, seedSellableProduct } from './sales-test-data';

describe('sales test data', () => {
  it('seeds a sellable product with one fixed-price version', async () => {
    const dependencies = createTestDependencies();

    const product = seedSellableProduct(dependencies, { name: 'Lámina Colibrí', price: 15000 });

    const [stored] = await dependencies.products.listActive();
    expect(stored?.id).toBe(product.id);
    expect(stored?.versions).toHaveLength(1);
    expect(stored?.versions[0]?.pricing).toEqual({ mode: 'fixed', price: 15000 });
  });

  it('seeds a negotiable product and one with several versions', async () => {
    const dependencies = createTestDependencies();

    seedSellableProduct(dependencies, { n: 2, name: 'Retrato', price: null });
    seedSellableProduct(dependencies, { n: 3, name: 'Print', versions: ['Print A4', 'Print A3'] });

    const products = await dependencies.products.listActive();
    expect(products.find((p) => p.name === 'Retrato')?.versions[0]?.pricing.mode).toBe(
      'negotiable',
    );
    expect(products.find((p) => p.name === 'Print')?.versions.map((v) => v.name)).toEqual([
      'Print A4',
      'Print A3',
    ]);
  });

  it('seeds a sale of a product on a date', async () => {
    const dependencies = createTestDependencies();
    const product = seedSellableProduct(dependencies, { price: 15000 });

    const record = seedSale(dependencies, { soldOn: '2026-06-30', product, quantity: 2 });

    const stored = await dependencies.sales.findById(record.id);
    expect(stored?.soldOn).toBe('2026-06-30');
    expect(stored?.items[0]).toMatchObject({ quantity: 2, unitPrice: 15000 });
  });

  it('seeds the "no vendí" mark of a week', async () => {
    const dependencies = createTestDependencies();

    seedNoSalesWeek(dependencies, '2026-06-29');

    const marks = await dependencies.noSalesWeeks.listBetween(
      '2026-06-29' as never,
      '2026-07-05' as never,
    );
    expect(marks.map((mark) => mark.weekStart)).toEqual(['2026-06-29']);
  });

  it('refuses a mark that is not on a Monday', () => {
    expect(() => {
      seedNoSalesWeek(createTestDependencies(), '2026-06-30');
    }).toThrow();
  });
});
