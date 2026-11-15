import { buildSaleRecordView, type SaleItemView } from '@/features/sales';
import {
  fixtureId,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
  productsById,
} from '@/features/sales/testing/sale-fixtures';
import { productPhotoIdSchema } from '@/shared/domain';

import { thumbnailOf, titleOf } from './sale-row-parts';

const catalog = productsById(
  makeProduct(1, [makeVersion(1)], { name: 'Lámina' }),
  makeProduct(2, [makeVersion(2, { productN: 2 })], { name: 'Sticker' }),
);

describe('titleOf', () => {
  it('names the first product and counts the others', () => {
    const view = buildSaleRecordView(makeSaleRecord([makeSaleItem(1), makeSaleItem(2)]), catalog);

    expect(titleOf(view)).toBe('Lámina y 1 más');
  });

  it('is only the name with a single product', () => {
    const view = buildSaleRecordView(makeSaleRecord([makeSaleItem(1)]), catalog);

    expect(titleOf(view)).toBe('Lámina');
  });
});

function itemViewWith(coverPhotoId: SaleItemView['coverPhotoId']): SaleItemView {
  const [item] = buildSaleRecordView(makeSaleRecord([makeSaleItem(1)]), catalog).items;
  if (item === undefined) throw new Error('A record with one item was expected');
  return { ...item, coverPhotoId };
}

describe('thumbnailOf', () => {
  it('is undefined without an item or without a cover photo', () => {
    expect(thumbnailOf(undefined)).toBeUndefined();
    expect(thumbnailOf(itemViewWith(null))).toBeUndefined();
  });

  it('is an element with a cover photo', () => {
    const coverPhotoId = productPhotoIdSchema.parse(fixtureId(5, 1));

    expect(thumbnailOf(itemViewWith(coverPhotoId))).toBeDefined();
  });
});
