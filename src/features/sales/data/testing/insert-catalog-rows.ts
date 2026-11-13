import type { AppDatabase } from '@/core/db/open';
import { productVersions } from '@/core/db/schema/product-versions';
import { products } from '@/core/db/schema/products';
import type { Product } from '@/features/products/domain';

/**
 * Inserta un producto y sus versiones directamente en las tablas, para que los ítems de venta
 * de los tests cumplan las llaves foráneas sin depender del repositorio de productos.
 */
export function insertCatalogRows(db: AppDatabase, product: Product): void {
  db.insert(products)
    .values({
      id: product.id,
      name: product.name,
      description: product.description,
      archivedAt: product.archivedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: null,
    })
    .run();
  for (const version of product.versions) {
    db.insert(productVersions)
      .values({
        id: version.id,
        productId: version.productId,
        name: version.name,
        pricingMode: version.pricing.mode,
        price: version.pricing.mode === 'fixed' ? version.pricing.price : null,
        cost: version.cost,
        position: version.position,
        archivedAt: version.archivedAt,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        deletedAt: null,
      })
      .run();
  }
}
