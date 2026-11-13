import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';

import {
  buildSaleRecord,
  diffItems,
  effectiveUnitCost,
  planSaleRecordUpdate,
  resolveItems,
  validateSoldOn,
} from './rules';
import type { SaveSaleRecordInput } from './schemas';
import {
  LATER,
  NOW,
  clp,
  date,
  makeItemInput,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
  productId,
  productsById,
  versionId,
} from './testing/sale-fixtures';

const TODAY = date('2026-07-10');

function context() {
  return { now: LATER, today: TODAY, ids: new SequentialIdGenerator() };
}

function input(overrides: Partial<SaveSaleRecordInput> = {}): SaveSaleRecordInput {
  return {
    soldOn: TODAY,
    channel: null,
    note: null,
    items: [makeItemInput()],
    ...overrides,
  };
}

const fixedProduct = makeProduct(1, [makeVersion(1, { cost: clp(400) })]);
const catalog = productsById(fixedProduct);

describe('validateSoldOn', () => {
  test('accepts today and the past', () => {
    expect(validateSoldOn(TODAY, TODAY, null)).toEqual([]);
    expect(validateSoldOn(date('2020-01-01'), TODAY, null)).toEqual([]);
  });

  test('rejects a date after today with future_date on soldOn', () => {
    expect(validateSoldOn(date('2026-07-11'), TODAY, null)).toEqual([
      { code: 'future_date', path: ['soldOn'] },
    ]);
  });

  test('an edit that keeps a "future" date passes (ADR-015, rule 6)', () => {
    const future = date('2026-07-20');

    expect(validateSoldOn(future, TODAY, future)).toEqual([]);
  });

  test('an edit that moves to another future date fails', () => {
    expect(validateSoldOn(date('2026-07-21'), TODAY, date('2026-07-20'))).toHaveLength(1);
  });
});

describe('resolveItems', () => {
  const resolve = (
    items: SaveSaleRecordInput['items'],
    products = catalog,
    existing = [] as ReturnType<typeof makeSaleItem>[],
  ) => resolveItems(items, products, existing, new SequentialIdGenerator());

  const errorsOf = (result: ReturnType<typeof resolve>) =>
    result.ok ? [] : result.error.map((e) => [e.code, ...e.path]);

  test('builds new items with the version price, copied cost, position and generated id', () => {
    const result = resolve([makeItemInput(1, { quantity: 3 }), makeItemInput(1)]);

    expect(result.ok && result.value).toEqual([
      {
        id: '00000000-0000-7000-8000-000000000001',
        productId: productId(1),
        productVersionId: versionId(1),
        quantity: 3,
        unitPrice: 1000,
        unitCost: 400,
        position: 0,
      },
      expect.objectContaining({ id: '00000000-0000-7000-8000-000000000002', position: 1 }),
    ]);
  });

  test('copies a null cost as null', () => {
    const products = productsById(makeProduct(1, [makeVersion(1)]));
    const result = resolve([makeItemInput()], products);

    expect(result.ok && result.value[0]?.unitCost).toBeNull();
  });

  test('uses the received price when given', () => {
    const result = resolve([makeItemInput(1, { unitPrice: clp(750) })]);

    expect(result.ok && result.value[0]?.unitPrice).toBe(750);
  });

  describe('negotiable versions', () => {
    const negotiable = productsById(
      makeProduct(1, [makeVersion(1, { pricing: { mode: 'negotiable' } })]),
    );

    test('require a price', () => {
      expect(errorsOf(resolve([makeItemInput(), makeItemInput()], negotiable))).toEqual([
        ['price_required', 'items', 0, 'unitPrice'],
        ['price_required', 'items', 1, 'unitPrice'],
      ]);
    });

    test('accept 0', () => {
      const result = resolve([makeItemInput(1, { unitPrice: clp(0) })], negotiable);

      expect(result.ok && result.value[0]?.unitPrice).toBe(0);
    });
  });

  test('product_not_found', () => {
    expect(errorsOf(resolve([makeItemInput()], productsById()))).toEqual([
      ['product_not_found', 'items', 0, 'productId'],
    ]);
  });

  test('product_archived for a new item', () => {
    const archived = productsById({ ...fixedProduct, archivedAt: NOW });

    expect(errorsOf(resolve([makeItemInput()], archived))).toEqual([
      ['product_archived', 'items', 0, 'productId'],
    ]);
  });

  test('version_not_found', () => {
    expect(errorsOf(resolve([makeItemInput(9)]))).toEqual([
      ['version_not_found', 'items', 0, 'productVersionId'],
    ]);
  });

  test('version_archived for a new item', () => {
    const archived = productsById(makeProduct(1, [makeVersion(1, { archivedAt: NOW })]));

    expect(errorsOf(resolve([makeItemInput()], archived))).toEqual([
      ['version_archived', 'items', 0, 'productVersionId'],
    ]);
  });

  test('version_product_mismatch when the version belongs to another product', () => {
    const other = makeProduct(2, [makeVersion(5, { productN: 2 })]);
    const products = productsById(fixedProduct, other);

    expect(errorsOf(resolve([makeItemInput(5)], products))).toEqual([
      ['version_product_mismatch', 'items', 0, 'productVersionId'],
    ]);
  });

  test('version_product_mismatch when the product lists a version that points elsewhere', () => {
    const broken = productsById(makeProduct(1, [makeVersion(1, { productN: 2 })]));

    expect(errorsOf(resolve([makeItemInput()], broken))).toEqual([
      ['version_product_mismatch', 'items', 0, 'productVersionId'],
    ]);
  });

  test('item_not_found for a foreign itemId', () => {
    const foreign = makeSaleItem(9).id;

    expect(errorsOf(resolve([makeItemInput(1, { itemId: foreign })]))).toEqual([
      ['item_not_found', 'items', 0, 'itemId'],
    ]);
  });

  test('item_not_found when the same itemId appears twice', () => {
    const existing = makeSaleItem(1);

    expect(
      errorsOf(
        resolve(
          [makeItemInput(1, { itemId: existing.id }), makeItemInput(1, { itemId: existing.id })],
          catalog,
          [existing],
        ),
      ),
    ).toEqual([['item_not_found', 'items', 1, 'itemId']]);
  });

  test('too_many_items above the technical cap', () => {
    const items = Array.from({ length: 101 }, () => makeItemInput());

    expect(errorsOf(resolve(items))).toEqual([['too_many_items', 'items']]);
  });

  test('reports every error found, not only the first', () => {
    expect(errorsOf(resolve([makeItemInput(8), makeItemInput(9)]))).toHaveLength(2);
  });

  describe('existing items', () => {
    const existing = makeSaleItem(1, { unitCost: clp(333), unitPrice: clp(900), quantity: 2 });

    test('keeps id and copied cost when the version is unchanged, even if the version is archived', () => {
      const archived = productsById(
        makeProduct(1, [makeVersion(1, { archivedAt: NOW, cost: clp(999) })], { archivedAt: NOW }),
      );
      const result = resolve([makeItemInput(1, { itemId: existing.id, quantity: 5 })], archived, [
        existing,
      ]);

      expect(result.ok && result.value).toEqual([
        { ...existing, quantity: 5, unitPrice: 900, unitCost: 333, position: 0 },
      ]);
    });

    test('keeps the stored price when the received one is null', () => {
      const result = resolve([makeItemInput(1, { itemId: existing.id })], catalog, [existing]);

      expect(result.ok && result.value[0]?.unitPrice).toBe(900);
    });

    test('keeps the item when the product is gone but the version is unchanged', () => {
      const result = resolve([makeItemInput(1, { itemId: existing.id })], productsById(), [
        existing,
      ]);

      expect(result.ok).toBe(true);
    });

    test('a version change re-validates and copies the new cost', () => {
      const products = productsById(
        makeProduct(1, [makeVersion(1), makeVersion(2, { cost: clp(55) })]),
      );
      const result = resolve(
        [makeItemInput(2, { itemId: existing.id, quantity: 2, unitPrice: clp(1200) })],
        products,
        [existing],
      );

      expect(result.ok && result.value[0]).toEqual({
        ...existing,
        productVersionId: versionId(2),
        unitPrice: 1200,
        unitCost: 55,
      });
    });

    test('a version change to an archived version is rejected', () => {
      const products = productsById(
        makeProduct(1, [makeVersion(1), makeVersion(2, { archivedAt: NOW })]),
      );

      expect(
        errorsOf(resolve([makeItemInput(2, { itemId: existing.id })], products, [existing])),
      ).toEqual([['version_archived', 'items', 0, 'productVersionId']]);
    });

    test('a version change with a null price on a fixed version takes the version price', () => {
      const products = productsById(
        makeProduct(1, [
          makeVersion(1),
          makeVersion(2, { pricing: { mode: 'fixed', price: clp(2500) } }),
        ]),
      );
      const result = resolve([makeItemInput(2, { itemId: existing.id })], products, [existing]);

      expect(result.ok && result.value[0]?.unitPrice).toBe(2500);
    });
  });
});

describe('effectiveUnitCost (D-26)', () => {
  test.each([
    [1000, 2000, 1000],
    [null, 2000, 2000],
    [null, null, null],
    [0, 2000, 0],
  ])('copied %p, current %p -> %p', (copied, current, expected) => {
    const item = { unitCost: copied === null ? null : clp(copied) };

    expect(effectiveUnitCost(item, current === null ? null : clp(current))).toBe(expected);
  });
});

describe('diffItems', () => {
  const a = makeSaleItem(1);
  const b = makeSaleItem(2);

  test('without changes the three lists are empty', () => {
    expect(diffItems([a, b], [{ ...a }, { ...b }])).toEqual({
      inserted: [],
      updated: [],
      removed: [],
    });
  });

  test('detects inserted items', () => {
    const c = makeSaleItem(3);

    expect(diffItems([a], [a, c]).inserted).toEqual([c]);
  });

  test('detects removed ids', () => {
    expect(diffItems([a, b], [a]).removed).toEqual([b.id]);
  });

  test.each([
    ['quantity', { quantity: 4 }],
    ['unitPrice', { unitPrice: clp(1) }],
    ['version', { productVersionId: versionId(2) }],
    ['position', { position: 5 }],
  ])('detects an updated %s', (_name, change) => {
    const changed = { ...a, ...change };

    expect(diffItems([a], [changed])).toEqual({ inserted: [], updated: [changed], removed: [] });
  });
});

describe('buildSaleRecord', () => {
  test('builds the record with ids, positions and timestamps', () => {
    const result = buildSaleRecord(
      input({ channel: 'fair', note: 'Feria', items: [makeItemInput(), makeItemInput()] }),
      catalog,
      context(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        soldOn: TODAY,
        channel: 'fair',
        note: 'Feria',
        createdAt: LATER,
        updatedAt: LATER,
      });
      expect(result.value.items.map((item) => item.position)).toEqual([0, 1]);
      expect(new Set([result.value.id, ...result.value.items.map((i) => i.id)]).size).toBe(3);
    }
  });

  test('no items gives no_items', () => {
    const result = buildSaleRecord(input({ items: [] }), catalog, context());

    expect(!result.ok && result.error).toEqual([{ code: 'no_items', path: ['items'] }]);
  });

  test('a future date gives future_date and does not hide item errors', () => {
    const result = buildSaleRecord(
      input({ soldOn: date('2026-07-11'), items: [makeItemInput(9)] }),
      catalog,
      context(),
    );

    expect(!result.ok && result.error.map((e) => e.code)).toEqual([
      'future_date',
      'version_not_found',
    ]);
  });
});

describe('planSaleRecordUpdate', () => {
  const existing = makeSaleItem(1, { unitCost: clp(400) });
  const current = makeSaleRecord([existing], { soldOn: date('2026-07-05'), updatedAt: NOW });
  const sameInput = (overrides: Partial<SaveSaleRecordInput> = {}) =>
    input({
      soldOn: current.soldOn,
      items: [makeItemInput(1, { itemId: existing.id })],
      ...overrides,
    });

  test('empty items plan a delete', () => {
    expect(planSaleRecordUpdate(current, sameInput({ items: [] }), catalog, context())).toEqual({
      ok: true,
      value: { kind: 'delete' },
    });
  });

  test('without changes: changed false, updatedAt intact and empty diff', () => {
    const result = planSaleRecordUpdate(current, sameInput(), catalog, context());

    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'update',
        record: current,
        diff: { inserted: [], updated: [], removed: [] },
        changed: false,
      },
    });
  });

  test('a changed field bumps updatedAt', () => {
    const result = planSaleRecordUpdate(current, sameInput({ note: 'Nueva' }), catalog, context());

    expect(result.ok && result.value.kind === 'update' && result.value.record).toMatchObject({
      note: 'Nueva',
      updatedAt: LATER,
      createdAt: NOW,
      id: current.id,
    });
    expect(result.ok && result.value.kind === 'update' && result.value.changed).toBe(true);
  });

  test('a changed item produces a diff and marks the record changed', () => {
    const result = planSaleRecordUpdate(
      current,
      sameInput({ items: [makeItemInput(1, { itemId: existing.id, quantity: 7 })] }),
      catalog,
      context(),
    );

    expect(result.ok && result.value.kind === 'update' && result.value.diff.updated).toHaveLength(
      1,
    );
    expect(result.ok && result.value.kind === 'update' && result.value.changed).toBe(true);
  });

  test('removing one of two items reports it as removed', () => {
    const second = makeSaleItem(2);
    const two = makeSaleRecord([existing, second], { soldOn: current.soldOn });
    const result = planSaleRecordUpdate(two, sameInput(), catalog, context());

    expect(result.ok && result.value.kind === 'update' && result.value.diff.removed).toEqual([
      second.id,
    ]);
  });

  test('keeps a "future" date unchanged but rejects moving it to another future date', () => {
    const futureRecord = makeSaleRecord([existing], { soldOn: date('2026-07-20') });
    const keep = planSaleRecordUpdate(
      futureRecord,
      sameInput({ soldOn: futureRecord.soldOn }),
      catalog,
      context(),
    );
    const move = planSaleRecordUpdate(
      futureRecord,
      sameInput({ soldOn: date('2026-07-21') }),
      catalog,
      context(),
    );

    expect(keep.ok).toBe(true);
    expect(!move.ok && move.error[0].code).toBe('future_date');
  });

  test('propagates item errors', () => {
    const result = planSaleRecordUpdate(
      current,
      sameInput({ items: [makeItemInput(9)] }),
      catalog,
      context(),
    );

    expect(!result.ok && result.error[0].code).toBe('version_not_found');
  });
});
