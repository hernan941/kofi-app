import { saleItemIdSchema, saleRecordIdSchema } from '@/shared/domain';

import {
  date,
  fixtureId,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
  productId,
  versionId,
} from '../domain/testing/sale-fixtures';
import {
  applySaleErrors,
  formTotal,
  outputSummary,
  newItemValues,
  saleFormSchema,
  toSaleFormValues,
  toSaveSaleRecordCommand,
  type SaleFormValues,
  type SaleItemFormValues,
} from './sale-form-schema';

const TODAY = date('2026-11-13');

const row = (overrides: Partial<SaleItemFormValues> = {}): SaleItemFormValues => ({
  itemId: null,
  productId: productId(1),
  productVersionId: versionId(1),
  quantity: 1,
  priceText: '15.000',
  pricingMode: 'fixed',
  ...overrides,
});

const values = (
  items: SaleItemFormValues[] = [row()],
  overrides: Partial<SaleFormValues> = {},
): SaleFormValues => ({
  soldOn: TODAY,
  channel: null,
  note: '',
  items,
  ...overrides,
});

/** Issues as `path: code`. */
function issuesOf(input: SaleFormValues): readonly string[] {
  const result = saleFormSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('saleFormSchema', () => {
  it('turns the texts into the domain input', () => {
    const result = saleFormSchema.parse(
      values([row({ quantity: 3, priceText: '1.500' })], { channel: 'fair', note: '  Feria  ' }),
    );

    expect(result).toEqual({
      soldOn: TODAY,
      channel: 'fair',
      note: 'Feria',
      items: [
        {
          itemId: null,
          productId: productId(1),
          productVersionId: versionId(1),
          quantity: 3,
          unitPrice: 1500,
        },
      ],
    });
  });

  it('keeps the id of an existing item', () => {
    const itemId = saleItemIdSchema.parse(fixtureId(3, 1));

    const result = saleFormSchema.parse(values([row({ itemId })]));

    expect(result.items[0]?.itemId).toBe(itemId);
  });

  it('turns an empty note into null', () => {
    expect(saleFormSchema.parse(values([row()], { note: '   ' })).note).toBeNull();
  });

  it('accepts a price of zero', () => {
    expect(saleFormSchema.parse(values([row({ priceText: '0' })])).items[0]?.unitPrice).toBe(0);
  });

  it('asks for the price of a negotiable version with its own message', () => {
    expect(issuesOf(values([row({ pricingMode: 'negotiable', priceText: '' })]))).toEqual([
      'items.0.priceText: price_required',
    ]);
  });

  it('asks for an amount when a fixed price was cleared', () => {
    expect(issuesOf(values([row({ priceText: '' })]))).toEqual(['items.0.priceText: empty']);
  });

  it('reports the code of a badly written amount', () => {
    expect(issuesOf(values([row({ priceText: '15,5' })]))).toEqual([
      'items.0.priceText: comma_not_allowed',
    ]);
  });

  it.each([0, 10000, 1.5])('rejects the quantity %s', (quantity) => {
    expect(issuesOf(values([row({ quantity })]))).toEqual([
      'items.0.quantity: quantity_out_of_range',
    ]);
  });

  it('rejects a note longer than 500 characters', () => {
    expect(issuesOf(values([row()], { note: 'a'.repeat(501) }))).toEqual(['note: too_long']);
  });

  it('points to the row that has the problem', () => {
    expect(issuesOf(values([row(), row({ priceText: '' })]))).toEqual(['items.1.priceText: empty']);
  });

  it('lets the domain decide about an empty list of items', () => {
    expect(saleFormSchema.parse(values([])).items).toEqual([]);
  });
});

describe('formTotal', () => {
  it('sums quantity times price', () => {
    expect(
      formTotal([
        row({ quantity: 2, priceText: '15.000' }),
        row({ quantity: 3, priceText: '1.000' }),
      ]),
    ).toBe(33000);
  });

  it('ignores prices that are not valid yet', () => {
    expect(
      formTotal([row({ quantity: 2, priceText: '' }), row({ quantity: 1, priceText: '2.000' })]),
    ).toBe(2000);
    expect(formTotal([row({ priceText: '15,5' })])).toBe(0);
  });

  it('is zero without items', () => {
    expect(formTotal([])).toBe(0);
  });

  it('ignores a quantity outside the allowed range instead of throwing', () => {
    expect(formTotal([row({ quantity: 0, priceText: '1.000' })])).toBe(0);
  });
});

describe('newItemValues', () => {
  const product = makeProduct(1, [makeVersion(1)]);

  it('preloads the fixed price without the dollar sign', () => {
    const [version] = product.versions;

    expect(newItemValues(product, version ?? makeVersion(1))).toEqual({
      itemId: null,
      productId: product.id,
      productVersionId: versionId(1),
      quantity: 1,
      priceText: '1.000',
      pricingMode: 'fixed',
    });
  });

  it('leaves the price empty when it is negotiable', () => {
    const negotiable = makeVersion(2, { pricing: { mode: 'negotiable' } });

    expect(newItemValues(product, negotiable)).toMatchObject({
      priceText: '',
      pricingMode: 'negotiable',
    });
  });
});

describe('toSaleFormValues', () => {
  const single = makeProduct(1, [makeVersion(1)]);
  const other = makeProduct(2, [makeVersion(2, { productN: 2 })]);

  it('starts empty, today, without channel or note', () => {
    expect(toSaleFormValues(null, TODAY, [single, other])).toEqual({
      soldOn: TODAY,
      channel: null,
      note: '',
      items: [],
    });
  });

  it('loads the only sellable product when it has a single version', () => {
    const result = toSaleFormValues(null, TODAY, [single]);

    expect(result.items).toEqual([newItemValues(single, makeVersion(1))]);
  });

  it('does not preload when the only product has several versions', () => {
    const many = makeProduct(1, [makeVersion(1), makeVersion(2)]);

    expect(toSaleFormValues(null, TODAY, [many]).items).toEqual([]);
  });

  it('does not preload without sellable products', () => {
    expect(toSaleFormValues(null, TODAY, []).items).toEqual([]);
  });

  it('loads a record with its items in order, price text and ids', () => {
    const record = makeSaleRecord(
      [
        makeSaleItem(1, { quantity: 2, unitPrice: 15000 as never }),
        makeSaleItem(2, { productId: productId(2), productVersionId: versionId(2), position: 1 }),
      ],
      {
        id: saleRecordIdSchema.parse(fixtureId(4, 1)),
        soldOn: date('2026-11-10'),
        channel: 'custom_order',
        note: 'Pedido de Ana',
      },
    );

    const result = toSaleFormValues(record, TODAY, [single]);

    expect(result.soldOn).toBe('2026-11-10');
    expect(result.channel).toBe('custom_order');
    expect(result.note).toBe('Pedido de Ana');
    expect(result.items.map((item) => [item.itemId, item.quantity, item.priceText])).toEqual([
      [fixtureId(3, 1), 2, '15.000'],
      [fixtureId(3, 2), 1, '1.000'],
    ]);
  });

  it('uses an empty note when the record has none', () => {
    expect(toSaleFormValues(makeSaleRecord(), TODAY, []).note).toBe('');
  });

  it('keeps the items of archived products when editing', () => {
    const archived = makeProduct(1, [makeVersion(1)], { archivedAt: 1 as never });
    const record = makeSaleRecord([makeSaleItem(1)]);

    const result = toSaleFormValues(record, TODAY, [], new Map([[archived.id, archived]]));

    expect(result.items).toHaveLength(1);
  });

  it('knows from the catalog whether an item was negotiable', () => {
    const negotiable = makeProduct(1, [makeVersion(1, { pricing: { mode: 'negotiable' } })]);
    const record = makeSaleRecord([makeSaleItem(1)]);

    const result = toSaleFormValues(record, TODAY, [], new Map([[negotiable.id, negotiable]]));

    expect(result.items[0]?.pricingMode).toBe('negotiable');
  });
});

describe('toSaveSaleRecordCommand', () => {
  const output = saleFormSchema.parse(values());

  it('creates when there is no record id', () => {
    expect(toSaveSaleRecordCommand(null, output)).toEqual({ kind: 'create', input: output });
  });

  it('updates the given record', () => {
    const recordId = saleRecordIdSchema.parse(fixtureId(4, 1));

    expect(toSaveSaleRecordCommand(recordId, output)).toEqual({
      kind: 'update',
      recordId,
      input: output,
    });
  });
});

describe('applySaleErrors', () => {
  it('sets the errors that have a field and returns the rest', () => {
    const setError = jest.fn();

    const rest = applySaleErrors(
      [
        { code: 'future_date', path: ['soldOn'] },
        { code: 'price_required', path: ['items', 1, 'unitPrice'] },
        { code: 'quantity_out_of_range', path: ['items', 0, 'quantity'] },
        { code: 'version_archived', path: ['items', 2, 'productVersionId'] },
        { code: 'no_items', path: ['items'] },
        { code: 'item_not_found', path: ['items', 0, 'itemId'] },
        { code: 'record_not_found', path: [] },
      ],
      setError,
    );

    expect(setError).toHaveBeenCalledWith(
      'soldOn',
      { message: 'future_date' },
      { shouldFocus: true },
    );
    expect(setError).toHaveBeenCalledWith(
      'items.1.priceText',
      { message: 'price_required' },
      { shouldFocus: false },
    );
    expect(setError).toHaveBeenCalledWith(
      'items.0.quantity',
      { message: 'quantity_out_of_range' },
      { shouldFocus: false },
    );
    expect(setError).toHaveBeenCalledWith(
      'items.2.productVersionId',
      { message: 'version_archived' },
      { shouldFocus: false },
    );
    expect(setError).toHaveBeenCalledWith(
      'items.root',
      { message: 'no_items' },
      { shouldFocus: false },
    );
    expect(rest.map((error) => error.code)).toEqual(['item_not_found', 'record_not_found']);
  });
});

describe('outputSummary', () => {
  it('sums the total and the number of products of the saved input', () => {
    const output = saleFormSchema.parse(
      values([row({ quantity: 2, priceText: '15.000' }), row({ quantity: 1, priceText: '1.000' })]),
    );

    expect(outputSummary(output)).toEqual({ total: 31000, productCount: 3 });
  });

  it('counts a missing price as zero', () => {
    const parsed = saleFormSchema.parse(values());
    const output = {
      ...parsed,
      items: parsed.items.slice(0, 1).map((item) => ({ ...item, unitPrice: null })),
    };

    expect(outputSummary(output)).toEqual({ total: 0, productCount: 1 });
  });
});
