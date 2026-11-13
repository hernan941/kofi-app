import {
  productPhotoIdSchema,
  productVersionIdSchema,
  type ProductId,
  type ProductPhotoId,
  type ProductVersionId,
} from '@/shared/domain';

import type { PhotoDiff, Product, ProductPhoto, ProductVersion } from '../domain';
import {
  PRODUCT_ID,
  clp,
  epoch,
  fixtureId,
  makeProduct,
  makeVersion,
} from '../domain/testing/product-fixtures';
import type { ProductRepository, ProductWriter } from './product-repository';
import type { SaleSeed } from './testing/sales-fixtures';

/** Lo que la suite de contrato necesita de cada implementación. */
export interface ProductRepositoryHarness {
  readonly repository: ProductRepository & ProductWriter;
  /** Registra una venta de una versión, con o sin borrado lógico del ítem o del registro. */
  addSale(seed: SaleSeed): void;
  dispose(): void;
}

const OTHER_PRODUCT_ID = fixtureId(2) as ProductId;
const T0 = epoch(1_700_000_000_000);
const T1 = epoch(1_700_000_100_000);
const T2 = epoch(1_700_000_200_000);

function otherProduct(versions: readonly ProductVersion[], overrides: Partial<Product> = {}) {
  return makeProduct(
    versions.map((version) => ({ ...version, productId: OTHER_PRODUCT_ID })),
    { id: OTHER_PRODUCT_ID, name: 'Taza', ...overrides },
  );
}

function photoCount(repository: ProductWriter, productId: ProductId): number {
  return repository.findByIdSync(productId)?.photos.length ?? 0;
}

function photoId(n: number): ProductPhotoId {
  return productPhotoIdSchema.parse(fixtureId(500 + n));
}

function makePhoto(n: number, overrides: Partial<ProductPhoto> = {}): ProductPhoto {
  return {
    id: photoId(n),
    productId: PRODUCT_ID,
    position: n,
    width: 1200,
    height: 800,
    byteSize: 1000 + n,
    sha256: 'a'.repeat(64),
    ...overrides,
  };
}

const EMPTY_DIFF: PhotoDiff = { inserted: [], moved: [], removed: [] };

function versionId(n: number): ProductVersionId {
  return productVersionIdSchema.parse(fixtureId(100 + n));
}

/**
 * Suite de contrato de `ProductRepository` y `ProductWriter`. La corren la implementación
 * Drizzle y el doble en memoria, para que el doble no mienta.
 */
export function runProductRepositoryContract(
  createHarness: () => Promise<ProductRepositoryHarness> | ProductRepositoryHarness,
): void {
  let harness: ProductRepositoryHarness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  describe('save and findById', () => {
    it('returns null for an unknown product', async () => {
      await expect(harness.repository.findById(PRODUCT_ID)).resolves.toBeNull();
    });

    it('stores a new product and reads it back with the versions ordered by position', async () => {
      const product = makeProduct([
        makeVersion(2, { name: 'C', pricing: { mode: 'negotiable' }, cost: clp(300) }),
        makeVersion(0, { name: 'A' }),
        makeVersion(1, { name: 'B', cost: clp(0) }),
      ]);

      await harness.repository.save(product);

      const stored = await harness.repository.findById(PRODUCT_ID);
      expect(stored).toEqual({
        ...product,
        versions: [product.versions[1], product.versions[2], product.versions[0]],
      });
    });

    it('updates versions by id: edits one, adds one and removes one', async () => {
      const original = makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'B' })]);
      await harness.repository.save(original);

      const edited = makeProduct(
        [makeVersion(0, { name: 'A2', cost: clp(50) }), makeVersion(2, { name: 'C' })],
        { name: 'Lámina grande', description: 'Nueva', updatedAt: T1 },
      );
      await harness.repository.save(edited);

      await expect(harness.repository.findById(PRODUCT_ID)).resolves.toEqual(edited);
    });

    it('keeps a removed version readable by id', async () => {
      await harness.repository.save(
        makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'B', cost: clp(7) })]),
      );
      await harness.repository.save(
        makeProduct([makeVersion(0, { name: 'A' })], { updatedAt: T1 }),
      );

      const versions = await harness.repository.findVersionsByIds([versionId(1)]);

      expect(versions.map((version) => version.id)).toEqual([versionId(1)]);
    });

    it('keeps an archived version in the aggregate', async () => {
      const product = makeProduct([
        makeVersion(0, { name: 'A' }),
        makeVersion(1, { name: 'B', archivedAt: T1 }),
      ]);

      await harness.repository.save(product);

      await expect(harness.repository.findById(PRODUCT_ID)).resolves.toEqual(product);
    });
  });

  describe('lists', () => {
    it('lists only active products in listActive and only archived ones in listArchived', async () => {
      const active = makeProduct([makeVersion(0)], { name: 'Activo' });
      const archived = otherProduct([makeVersion(3)], { archivedAt: T1, updatedAt: T1 });
      await harness.repository.save(active);
      await harness.repository.save(archived);

      await expect(harness.repository.listActive()).resolves.toEqual([active]);
      await expect(harness.repository.listArchived()).resolves.toEqual([archived]);
    });

    it('returns empty lists when there are no products', async () => {
      await expect(harness.repository.listActive()).resolves.toEqual([]);
      await expect(harness.repository.listArchived()).resolves.toEqual([]);
    });
  });

  describe('setArchived', () => {
    it('archives and unarchives, updating updatedAt', async () => {
      await harness.repository.save(makeProduct([makeVersion(0)]));

      await harness.repository.setArchived(PRODUCT_ID, T1, T1);
      const archived = await harness.repository.findById(PRODUCT_ID);
      await harness.repository.setArchived(PRODUCT_ID, null, T2);
      const restored = await harness.repository.findById(PRODUCT_ID);

      expect(archived).toMatchObject({ archivedAt: T1, updatedAt: T1, createdAt: T0 });
      expect(restored).toMatchObject({ archivedAt: null, updatedAt: T2 });
      await expect(harness.repository.listActive()).resolves.toHaveLength(1);
    });
  });

  describe('versionIdsWithSales', () => {
    beforeEach(async () => {
      await harness.repository.save(makeProduct([makeVersion(0), makeVersion(1), makeVersion(2)]));
      await harness.repository.save(otherProduct([makeVersion(3)]));
    });

    it('is empty when there are no sales', async () => {
      await expect(harness.repository.versionIdsWithSales(PRODUCT_ID)).resolves.toEqual(new Set());
    });

    it('counts only active items of active records and does not mix products', async () => {
      harness.addSale({ productId: PRODUCT_ID, versionId: versionId(0) });
      harness.addSale({ productId: PRODUCT_ID, versionId: versionId(1), itemDeleted: true });
      harness.addSale({ productId: PRODUCT_ID, versionId: versionId(2), recordDeleted: true });
      harness.addSale({ productId: OTHER_PRODUCT_ID, versionId: versionId(3) });

      await expect(harness.repository.versionIdsWithSales(PRODUCT_ID)).resolves.toEqual(
        new Set([versionId(0)]),
      );
      expect(harness.repository.versionIdsWithSalesSync(OTHER_PRODUCT_ID)).toEqual(
        new Set([versionId(3)]),
      );
    });
  });

  describe('versionIdsWithSales with an incoherent sale', () => {
    it('resolves the product from the stored version, not from the product id of the sale', async () => {
      await harness.repository.save(makeProduct([makeVersion(0), makeVersion(1)]));
      await harness.repository.save(otherProduct([makeVersion(3)]));
      harness.addSale({ productId: OTHER_PRODUCT_ID, versionId: versionId(0) });

      await expect(harness.repository.versionIdsWithSales(PRODUCT_ID)).resolves.toEqual(
        new Set([versionId(0)]),
      );
      await expect(harness.repository.versionIdsWithSales(OTHER_PRODUCT_ID)).resolves.toEqual(
        new Set(),
      );
    });
  });

  describe('findVersionsByIds and currentCostsFor', () => {
    beforeEach(async () => {
      await harness.repository.save(
        makeProduct([
          makeVersion(0, { name: 'A', cost: clp(120) }),
          makeVersion(1, { name: 'B', archivedAt: T1, cost: clp(0) }),
          makeVersion(2, { name: 'C', pricing: { mode: 'negotiable' } }),
        ]),
      );
    });

    it('returns versions in any state and omits unknown ids', async () => {
      const versions = await harness.repository.findVersionsByIds([
        versionId(1),
        versionId(0),
        versionId(9),
      ]);

      expect(versions.map((version) => version.id).sort()).toEqual([versionId(0), versionId(1)]);
      expect(versions.find((version) => version.id === versionId(1))?.archivedAt).toBe(T1);
    });

    it('returns an empty result for an empty list of ids', async () => {
      await expect(harness.repository.findVersionsByIds([])).resolves.toEqual([]);
      await expect(harness.repository.currentCostsFor([])).resolves.toEqual(new Map());
    });

    it('returns the current cost, null without cost, also for archived versions', async () => {
      const costs = await harness.repository.currentCostsFor([
        versionId(0),
        versionId(1),
        versionId(2),
        versionId(9),
      ]);

      expect(costs).toEqual(
        new Map([
          [versionId(0), clp(120)],
          [versionId(1), clp(0)],
          [versionId(2), null],
        ]),
      );
    });
  });

  describe('photos', () => {
    beforeEach(async () => {
      await harness.repository.save(makeProduct([makeVersion(0)]));
    });

    it('inserts, moves and removes photos by id and reads the active ones in order', () => {
      const { repository } = harness;
      repository.savePhotosSync(
        PRODUCT_ID,
        { ...EMPTY_DIFF, inserted: [makePhoto(0), makePhoto(1), makePhoto(2)] },
        T1,
      );

      repository.savePhotosSync(
        PRODUCT_ID,
        {
          inserted: [],
          moved: [
            { id: photoId(0), position: 1 },
            { id: photoId(1), position: 0 },
          ],
          removed: [photoId(2)],
        },
        T2,
      );

      expect(repository.findByIdSync(PRODUCT_ID)?.photos).toEqual([
        makePhoto(1, { position: 0 }),
        makePhoto(0, { position: 1 }),
      ]);
    });

    it('lists the active photo ids of archived products and excludes the removed ones', async () => {
      const { repository } = harness;
      repository.savePhotosSync(
        PRODUCT_ID,
        { ...EMPTY_DIFF, inserted: [makePhoto(0), makePhoto(1)] },
        T1,
      );
      repository.savePhotosSync(PRODUCT_ID, { ...EMPTY_DIFF, removed: [photoId(1)] }, T1);
      await repository.setArchived(PRODUCT_ID, T2, T2);

      await expect(repository.activePhotoIds()).resolves.toEqual(new Set([photoId(0)]));
      expect(repository.activePhotoIdsSync()).toEqual(new Set([photoId(0)]));
    });

    it('counts only the active photos of the product', () => {
      const { repository } = harness;
      repository.savePhotosSync(
        PRODUCT_ID,
        { ...EMPTY_DIFF, inserted: [makePhoto(0), makePhoto(1), makePhoto(2)] },
        T1,
      );
      repository.savePhotosSync(PRODUCT_ID, { ...EMPTY_DIFF, removed: [photoId(0)] }, T1);

      expect(photoCount(repository, PRODUCT_ID)).toBe(2);
      expect(photoCount(repository, OTHER_PRODUCT_ID)).toBe(0);
    });

    it('accepts exactly six active photos', () => {
      const six = [0, 1, 2, 3, 4, 5].map((n) => makePhoto(n));

      harness.repository.savePhotosSync(PRODUCT_ID, { ...EMPTY_DIFF, inserted: six }, T1);

      expect(photoCount(harness.repository, PRODUCT_ID)).toBe(6);
    });

    it('throws and writes nothing when the diff would leave more than six active photos', () => {
      const { repository } = harness;
      repository.savePhotosSync(
        PRODUCT_ID,
        { ...EMPTY_DIFF, inserted: [0, 1, 2, 3, 4, 5].map((n) => makePhoto(n)) },
        T1,
      );

      expect(() => {
        repository.savePhotosSync(PRODUCT_ID, { ...EMPTY_DIFF, inserted: [makePhoto(6)] }, T2);
      }).toThrow();

      expect(photoCount(repository, PRODUCT_ID)).toBe(6);
      expect(repository.activePhotoIdsSync().has(photoId(6))).toBe(false);
    });

    it('does not count a removed id that is not an active photo of the product', async () => {
      const { repository } = harness;
      await repository.save(otherProduct([makeVersion(3)]));
      repository.savePhotosSync(
        OTHER_PRODUCT_ID,
        { ...EMPTY_DIFF, inserted: [makePhoto(9, { productId: OTHER_PRODUCT_ID })] },
        T1,
      );
      repository.savePhotosSync(
        PRODUCT_ID,
        { ...EMPTY_DIFF, inserted: [0, 1, 2, 3, 4, 5].map((n) => makePhoto(n)) },
        T1,
      );

      expect(() => {
        repository.savePhotosSync(
          PRODUCT_ID,
          { inserted: [makePhoto(6)], moved: [], removed: [photoId(9), photoId(77)] },
          T2,
        );
      }).toThrow();

      expect(photoCount(repository, PRODUCT_ID)).toBe(6);
      expect(photoCount(repository, OTHER_PRODUCT_ID)).toBe(1);
    });

    it('never moves or removes a photo that belongs to another product', async () => {
      const { repository } = harness;
      await repository.save(otherProduct([makeVersion(3)]));
      repository.savePhotosSync(
        OTHER_PRODUCT_ID,
        { ...EMPTY_DIFF, inserted: [makePhoto(9, { productId: OTHER_PRODUCT_ID, position: 0 })] },
        T1,
      );

      repository.savePhotosSync(
        PRODUCT_ID,
        { inserted: [], moved: [{ id: photoId(9), position: 4 }], removed: [] },
        T2,
      );
      repository.savePhotosSync(PRODUCT_ID, { ...EMPTY_DIFF, removed: [photoId(9)] }, T2);

      expect(repository.findByIdSync(OTHER_PRODUCT_ID)?.photos).toEqual([
        makePhoto(9, { productId: OTHER_PRODUCT_ID, position: 0 }),
      ]);
    });

    it('allows a diff that removes photos and inserts others in the same call', () => {
      const { repository } = harness;
      repository.savePhotosSync(
        PRODUCT_ID,
        { ...EMPTY_DIFF, inserted: [0, 1, 2, 3, 4, 5].map((n) => makePhoto(n)) },
        T1,
      );

      repository.savePhotosSync(
        PRODUCT_ID,
        { inserted: [makePhoto(6, { position: 5 })], moved: [], removed: [photoId(5)] },
        T2,
      );

      expect(photoCount(repository, PRODUCT_ID)).toBe(6);
    });
  });

  describe('findByIds', () => {
    it('returns products in any state but deleted, skips unknown ids and includes photos', async () => {
      const { repository } = harness;
      await repository.save(makeProduct([makeVersion(0)]));
      await repository.save(otherProduct([makeVersion(1)]));
      await repository.setArchived(OTHER_PRODUCT_ID, T1, T1);
      repository.savePhotosSync(PRODUCT_ID, { ...EMPTY_DIFF, inserted: [makePhoto(0)] }, T1);

      const found = await repository.findByIds([
        OTHER_PRODUCT_ID,
        PRODUCT_ID,
        fixtureId(99) as ProductId,
      ]);

      expect(found.map((product) => product.id).sort()).toEqual(
        [PRODUCT_ID, OTHER_PRODUCT_ID].sort(),
      );
      expect(found.find((product) => product.id === PRODUCT_ID)?.photos).toEqual([makePhoto(0)]);
      await expect(repository.findByIds([])).resolves.toEqual([]);
    });
  });

  describe('asynchronous failures', () => {
    it('reports a failed save as a rejection, never as a synchronous throw', async () => {
      await harness.repository.save(
        makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'B' })]),
      );
      harness.addSale({ productId: PRODUCT_ID, versionId: versionId(1) });
      let pending: Promise<void> | undefined;

      expect(() => {
        pending = harness.repository.save(makeProduct([makeVersion(0, { name: 'A' })]));
      }).not.toThrow();

      await expect(pending).rejects.toThrow();
    });
  });

  describe('synchronous writer', () => {
    it('reads and writes through the sync methods', () => {
      const product = makeProduct([makeVersion(0, { name: 'A' })]);

      harness.repository.saveSync(product);
      harness.repository.setArchivedSync(PRODUCT_ID, T1, T1);

      expect(harness.repository.findByIdSync(PRODUCT_ID)).toEqual({
        ...product,
        archivedAt: T1,
        updatedAt: T1,
      });
      expect(harness.repository.findByIdSync(OTHER_PRODUCT_ID)).toBeNull();
    });

    it('throws and writes nothing when saveSync would delete a version with sales', async () => {
      const original = makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'B' })]);
      await harness.repository.save(original);
      harness.addSale({ productId: PRODUCT_ID, versionId: versionId(1) });

      expect(() => {
        harness.repository.saveSync(
          makeProduct([makeVersion(0, { name: 'Z' })], { name: 'Cambiado', updatedAt: T1 }),
        );
      }).toThrow();

      await expect(harness.repository.findById(PRODUCT_ID)).resolves.toEqual(original);
    });
  });
}
