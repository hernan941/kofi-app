import { createHash } from 'node:crypto';

import { tipIdSchema } from '@/features/tips/domain';
import {
  addDays,
  clpSchema,
  deterministicId,
  epochMsSchema,
  isoWeekStart,
  localDateSchema,
  noSalesWeekIdSchema,
  productIdSchema,
  productPhotoIdSchema,
  productVersionIdSchema,
  saleItemIdSchema,
  saleRecordIdSchema,
  type EpochMs,
  type LocalDate,
  type ProductId,
  type ProductPhotoId,
} from '@/shared/domain';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';

import type {
  DatabaseSnapshot,
  SnapshotNoSalesWeekRow,
  SnapshotProductPhotoRow,
  SnapshotProductRow,
  SnapshotProductVersionRow,
  SnapshotSaleItemRow,
  SnapshotSaleRecordRow,
} from '@/features/backup/domain';
import { jpegDimensions, paddedJpeg } from './padded-jpeg';

/** Instante fijo de los fixtures: los datos no se mueven con el día en que corre el E2E. */
export const FIXTURE_NOW = epochMsSchema.parse(Date.parse('2026-11-01T12:00:00Z'));
/** Último día con ventas en los fixtures. */
export const FIXTURE_LAST_SALE_DAY = localDateSchema.parse('2026-10-30');

const BASIC_PHOTO_BYTES = 120_000;
const LARGE_PHOTO_BYTES = 250_000;
const LARGE_PRODUCT_COUNT = 200;
const LARGE_DAYS = 1096;
const CHANNELS = ['fair', 'social_media', 'store_or_consignment', null] as const;
const BASIC_TIPS = ['registro-primera-venta', 'registro-constancia', 'costos-para-que-sirven'];

/** Fixture listo para empaquetar: filas y bytes de cada foto. */
export interface FixtureData {
  readonly snapshot: DatabaseSnapshot;
  readonly photos: ReadonlyMap<ProductPhotoId, Uint8Array>;
}

interface Builder {
  readonly clock: FakeClock;
  readonly ids: SequentialIdGenerator;
  readonly products: SnapshotProductRow[];
  readonly versions: SnapshotProductVersionRow[];
  readonly photoRows: SnapshotProductPhotoRow[];
  readonly records: SnapshotSaleRecordRow[];
  readonly items: SnapshotSaleItemRow[];
  readonly photoBytes: Map<ProductPhotoId, Uint8Array>;
}

function createBuilder(): Builder {
  return {
    clock: new FakeClock(FIXTURE_NOW),
    ids: new SequentialIdGenerator(),
    products: [],
    versions: [],
    photoRows: [],
    records: [],
    items: [],
    photoBytes: new Map(),
  };
}

function instantOf(date: LocalDate, hour: number): EpochMs {
  return epochMsSchema.parse(Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00Z`));
}

interface VersionSpec {
  readonly name: string | null;
  readonly price: number | null;
  readonly cost?: number;
  readonly archived?: boolean;
}

function addProduct(
  builder: Builder,
  spec: {
    readonly name: string;
    readonly description?: string;
    readonly archived?: boolean;
    readonly versions: readonly VersionSpec[];
  },
): ProductId {
  const id = productIdSchema.parse(builder.ids.next());
  const createdAt = epochMsSchema.parse(FIXTURE_NOW - (builder.products.length + 400) * 86_400_000);
  builder.products.push({
    id,
    name: spec.name,
    description: spec.description ?? null,
    archivedAt: spec.archived === true ? epochMsSchema.parse(FIXTURE_NOW - 86_400_000) : null,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  });
  spec.versions.forEach((version, position) => {
    builder.versions.push({
      id: productVersionIdSchema.parse(builder.ids.next()),
      productId: id,
      name: version.name,
      pricingMode: version.price === null ? 'negotiable' : 'fixed',
      price: version.price === null ? null : clpSchema.parse(version.price),
      cost: version.cost === undefined ? null : clpSchema.parse(version.cost),
      position,
      archivedAt: version.archived === true ? createdAt : null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });
  });
  return id;
}

function addPhoto(
  builder: Builder,
  productId: ProductId,
  base: Uint8Array,
  targetBytes: number,
  seed: number,
): void {
  const bytes = paddedJpeg(base, targetBytes, seed);
  const size = jpegDimensions(bytes);
  if (size === null) {
    throw new RangeError('The photo base has no readable dimensions.');
  }
  const id = productPhotoIdSchema.parse(builder.ids.next());
  const createdAt = epochMsSchema.parse(FIXTURE_NOW - 86_400_000 * 30);
  builder.photoRows.push({
    id,
    productId,
    position: 0,
    width: size.width,
    height: size.height,
    byteSize: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  });
  builder.photoBytes.set(id, bytes);
}

function addSale(
  builder: Builder,
  soldOn: LocalDate,
  index: number,
  picks: readonly SnapshotProductVersionRow[],
): void {
  const createdAt = instantOf(soldOn, 15);
  const id = saleRecordIdSchema.parse(builder.ids.next());
  builder.records.push({
    id,
    soldOn,
    channel: CHANNELS[index % CHANNELS.length] ?? null,
    note: index % 7 === 0 ? 'Feria del barrio' : null,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  });
  picks.forEach((version, position) => {
    builder.items.push({
      id: saleItemIdSchema.parse(builder.ids.next()),
      saleRecordId: id,
      productId: version.productId,
      productVersionId: version.id,
      quantity: 1 + ((index + position) % 3),
      unitPrice: version.price ?? clpSchema.parse(4000),
      unitCost: version.cost,
      position,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
    });
  });
}

function noSalesWeek(weekStart: LocalDate): SnapshotNoSalesWeekRow {
  const createdAt = instantOf(addDays(weekStart, 6), 20);
  return {
    id: noSalesWeekIdSchema.parse(deterministicId(weekStart)),
    weekStart,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
}

function activeVersions(builder: Builder): SnapshotProductVersionRow[] {
  const archivedProducts = new Set(
    builder.products.filter((row) => row.archivedAt !== null).map((row) => row.id),
  );
  return builder.versions.filter(
    (row) => row.archivedAt === null && !archivedProducts.has(row.productId),
  );
}

function finish(builder: Builder, noSales: SnapshotNoSalesWeekRow[], tipSlugs: readonly string[]) {
  const snapshot: DatabaseSnapshot = {
    products: builder.products,
    productVersions: builder.versions,
    productPhotos: builder.photoRows,
    saleRecords: builder.records,
    saleItems: builder.items,
    noSalesWeeks: noSales,
    tipViews: tipSlugs.map((slug, index) => ({
      tipId: tipIdSchema.parse(slug),
      firstSeenAt: instantOf(addDays(FIXTURE_LAST_SALE_DAY, -index * 10), 10),
      updatedAt: instantOf(addDays(FIXTURE_LAST_SALE_DAY, -index * 10), 10),
    })),
  };
  return { snapshot, photos: builder.photoBytes } satisfies FixtureData;
}

/**
 * Fixture `basic`: 5 productos (uno archivado, uno con tres versiones, una "a convenir" y con
 * costo), 2 fotos, unas 20 ventas en las 8 semanas anteriores al 2026-11-01, una semana de
 * "no vendí" y 3 consejos vistos. Determinista: mismo `base`, mismos datos.
 */
export function createBasicFixture(galleryJpegs: readonly Uint8Array[]): FixtureData {
  const builder = createBuilder();
  const first = addProduct(builder, {
    name: 'Lámina ñandú',
    description: 'Acuarela con marco',
    versions: [
      { name: 'A5', price: 3000, cost: 1200 },
      { name: 'A4', price: 5000, cost: 1800 },
      { name: 'A3', price: null },
    ],
  });
  const second = addProduct(builder, {
    name: 'Taza',
    versions: [{ name: null, price: 4500, cost: 2000 }],
  });
  addProduct(builder, { name: 'Llavero', archived: true, versions: [{ name: null, price: 1500 }] });
  addProduct(builder, { name: 'Cuaderno', versions: [{ name: null, price: 6000 }] });
  addProduct(builder, { name: 'Stickers', versions: [{ name: null, price: 1500, cost: 400 }] });
  addPhoto(builder, first, galleryJpegs[0] ?? new Uint8Array(), BASIC_PHOTO_BYTES, 1);
  addPhoto(builder, second, galleryJpegs[1] ?? new Uint8Array(), BASIC_PHOTO_BYTES, 2);

  const sellable = activeVersions(builder);
  const emptyWeek = isoWeekStart(addDays(FIXTURE_LAST_SALE_DAY, -21));
  let index = 0;
  for (let offset = 55, step = 2; offset >= 0; offset -= step, step = 5 - step) {
    const soldOn = addDays(FIXTURE_LAST_SALE_DAY, -offset);
    if (isoWeekStart(soldOn) === emptyWeek) {
      continue;
    }
    const picks = [sellable[index % sellable.length], sellable[(index + 2) % sellable.length]]
      .filter((version) => version !== undefined)
      .slice(0, 1 + (index % 2));
    addSale(builder, soldOn, index, picks);
    index += 1;
  }
  return finish(builder, [noSalesWeek(emptyWeek)], BASIC_TIPS);
}

/**
 * Fixture `large`: 200 productos, 200 fotos de unos 250 KB, ventas durante tres años (hasta el
 * 2026-10-30) y semanas de "no vendí" dispersas. Determinista.
 */
export function createLargeFixture(galleryJpegs: readonly Uint8Array[]): FixtureData {
  const builder = createBuilder();
  for (let n = 0; n < LARGE_PRODUCT_COUNT; n += 1) {
    const versions: VersionSpec[] =
      n % 5 === 0
        ? [
            { name: 'Chico', price: 2000 + n * 10, cost: 800 },
            { name: 'Grande', price: 4000 + n * 10, cost: 1500 },
          ]
        : [
            {
              name: null,
              price: n % 9 === 0 ? null : 1500 + n * 25,
              cost: n % 4 === 0 ? 600 : undefined,
            },
          ];
    const id = addProduct(builder, {
      name: `Producto ${String(n + 1).padStart(3, '0')}`,
      archived: n % 50 === 49,
      versions,
    });
    addPhoto(
      builder,
      id,
      galleryJpegs[n % galleryJpegs.length] ?? new Uint8Array(),
      LARGE_PHOTO_BYTES,
      n + 1,
    );
  }
  const sellable = activeVersions(builder);
  const firstDay = addDays(FIXTURE_LAST_SALE_DAY, -(LARGE_DAYS - 1));
  const emptyWeeks = new Set<LocalDate>();
  for (let weekNumber = 3; weekNumber * 7 < LARGE_DAYS; weekNumber += 13) {
    emptyWeeks.add(isoWeekStart(addDays(firstDay, weekNumber * 7)));
  }
  let index = 0;
  for (let day = 0; day < LARGE_DAYS; day += 1) {
    const soldOn = addDays(firstDay, day);
    if (day % 4 === 3 || emptyWeeks.has(isoWeekStart(soldOn))) {
      continue;
    }
    const count = 1 + (index % 3);
    const picks = Array.from(
      { length: count },
      (_, k) => sellable[(index * 7 + k * 13) % sellable.length],
    );
    addSale(
      builder,
      soldOn,
      index,
      picks.filter((version) => version !== undefined),
    );
    index += 1;
  }
  return finish(builder, [...emptyWeeks].sort().map(noSalesWeek), BASIC_TIPS);
}
