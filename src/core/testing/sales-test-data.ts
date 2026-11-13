import { noSalesWeekOf } from '@/features/sales/domain';
import {
  clp,
  date,
  fixtureId,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
} from '@/features/sales/testing/sale-fixtures';
import { saleRecordIdSchema } from '@/shared/domain';
import type { Product } from '@/features/products/domain';
import type { SaleRecord } from '@/features/sales/domain';

import type { TestDependencies } from './create-test-dependencies';

/** Opciones de {@link seedSellableProduct}. */
export interface SeedProductOptions {
  /** Número del producto: define su id. */
  readonly n?: number;
  readonly name?: string;
  /** Precio fijo de la versión; `null` es "a convenir". */
  readonly price?: number | null;
  /** Nombres de varias versiones; todas con el mismo precio. */
  readonly versions?: readonly string[];
}

/** Guarda en los dobles un producto vendible (con una o varias versiones activas) y lo devuelve. */
export function seedSellableProduct(
  dependencies: TestDependencies,
  { n = 1, name = 'Lámina', price = 1000, versions }: SeedProductOptions = {},
): Product {
  const pricing =
    price === null
      ? ({ mode: 'negotiable' } as const)
      : ({ mode: 'fixed', price: clp(price) } as const);
  const names = versions ?? [null];
  const product = makeProduct(
    n,
    names.map((versionName, index) =>
      makeVersion(n * 10 + index, { productN: n, name: versionName, pricing, position: index }),
    ),
    { name },
  );
  dependencies.products.saveSync(product);
  return product;
}

/** Opciones de {@link seedSale}. */
export interface SeedSaleOptions {
  readonly soldOn?: string;
  readonly product: Product;
  readonly quantity?: number;
  /** Número del registro: define su id. */
  readonly n?: number;
}

/** Guarda en los dobles una venta de la primera versión de un producto y la devuelve. */
export function seedSale(
  dependencies: TestDependencies,
  { soldOn = '2026-07-01', product, quantity = 1, n = 1 }: SeedSaleOptions,
): SaleRecord {
  const [version] = product.versions;
  if (version === undefined) {
    throw new Error('The product has no version to sell.');
  }
  const unitPrice = version.pricing.mode === 'fixed' ? version.pricing.price : clp(0);
  const record = makeSaleRecord(
    [
      makeSaleItem(n, {
        productId: product.id,
        productVersionId: version.id,
        quantity,
        unitPrice,
        unitCost: version.cost,
      }),
    ],
    { id: saleRecordIdSchema.parse(fixtureId(4, n)), soldOn: date(soldOn) },
  );
  dependencies.sales.saveSync(record);
  return record;
}

/** Marca como "no vendí" la semana que empieza el lunes dado. */
export function seedNoSalesWeek(dependencies: TestDependencies, weekStart: string): void {
  const week = noSalesWeekOf(date(weekStart));
  if (!week.ok) {
    throw new Error(`${weekStart} is not the Monday of a week.`);
  }
  dependencies.noSalesWeeks.markSync(week.value, dependencies.clock.now());
}
