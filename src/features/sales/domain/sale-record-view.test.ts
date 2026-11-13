import type { ProductPhotoId } from '@/shared/domain';

import { buildSaleRecordView } from './sale-record-view';
import {
  NOW,
  clp,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
  productsById,
  versionId,
} from './testing/sale-fixtures';

const photo = (id: string) => ({
  id: id as ProductPhotoId,
  productId: makeProduct(1, []).id,
  position: 0,
  width: 10,
  height: 10,
  byteSize: 1,
  sha256: 'x',
});

describe('buildSaleRecordView', () => {
  it('shows the current product and version names, the cover and the total', () => {
    const product = makeProduct(
      1,
      [makeVersion(1, { name: 'A4' }), makeVersion(2, { name: 'A3' })],
      {
        name: 'Lámina',
        photos: [photo('22222222-2222-7222-8222-222222222222')],
      },
    );
    const record = makeSaleRecord([
      makeSaleItem(1, { quantity: 2, unitPrice: clp(1500) }),
      makeSaleItem(2, { productVersionId: versionId(2) }),
    ]);

    const view = buildSaleRecordView(record, productsById(product));

    expect(view.total).toBe(4000);
    expect(view.record).toBe(record);
    expect(view.items[0]).toMatchObject({
      productName: 'Lámina',
      versionName: 'A4',
      showVersion: true,
      isArchived: false,
      coverPhotoId: '22222222-2222-7222-8222-222222222222',
    });
  });

  it('hides the version when the product has a single version', () => {
    const product = makeProduct(1, [makeVersion(1, { name: 'Estándar' })]);

    const view = buildSaleRecordView(makeSaleRecord(), productsById(product));

    expect(view.items[0]).toMatchObject({ showVersion: false, coverPhotoId: null });
  });

  it('flags archived products and archived or missing versions', () => {
    const archivedProduct = makeProduct(1, [makeVersion(1)], { archivedAt: NOW });
    const archivedVersion = makeProduct(1, [makeVersion(1, { archivedAt: NOW })]);
    const missingVersion = makeProduct(1, [makeVersion(5)]);

    for (const product of [archivedProduct, archivedVersion, missingVersion]) {
      const view = buildSaleRecordView(makeSaleRecord(), productsById(product));
      expect(view.items[0]?.isArchived).toBe(true);
    }
  });

  it('tolerates an unknown product and a record without items', () => {
    const view = buildSaleRecordView(makeSaleRecord(), new Map());
    expect(view.items[0]).toMatchObject({ productName: null, versionName: null, isArchived: true });

    expect(buildSaleRecordView(makeSaleRecord([]), new Map())).toMatchObject({
      items: [],
      total: 0,
    });
  });
});
