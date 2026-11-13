import { MAX_SALE_TOTAL, activeItemsTotal, hasItems, recordTotal } from './sale';
import { clp, makeSaleItem, makeSaleRecord } from './testing/sale-fixtures';

describe('recordTotal', () => {
  test('sums quantity times unit price', () => {
    const record = makeSaleRecord([
      makeSaleItem(1, { quantity: 2, unitPrice: clp(1500) }),
      makeSaleItem(2, { quantity: 3, unitPrice: clp(200) }),
    ]);

    expect(recordTotal(record)).toBe(3600);
  });

  test('counts a zero price as zero', () => {
    expect(recordTotal(makeSaleRecord([makeSaleItem(1, { unitPrice: clp(0) })]))).toBe(0);
  });

  test('a record without active items adds up to 0 (ADR-007, rule 15)', () => {
    expect(recordTotal(makeSaleRecord([]))).toBe(0);
  });

  test('saturates at the maximum amount instead of overflowing', () => {
    const record = makeSaleRecord([
      makeSaleItem(1, { quantity: 9999, unitPrice: clp(999_999_999) }),
    ]);

    expect(recordTotal(record)).toBe(MAX_SALE_TOTAL);
    expect(MAX_SALE_TOTAL).toBe(999_999_999);
  });
});

describe('activeItemsTotal', () => {
  test('sums a bare item list', () => {
    expect(activeItemsTotal([makeSaleItem(1, { quantity: 2 })])).toBe(2000);
  });
});

describe('hasItems', () => {
  test('is false for a broken record and true otherwise', () => {
    expect(hasItems(makeSaleRecord([]))).toBe(false);
    expect(hasItems(makeSaleRecord())).toBe(true);
  });
});
