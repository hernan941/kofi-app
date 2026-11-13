import { SALE_ITEMS_MAX } from './sale';
import {
  quantitySchema,
  saleChannelSchema,
  saleItemInputSchema,
  saleNoteSchema,
  saveSaleRecordInputSchema,
} from './schemas';
import { clp, date, makeItemInput } from './testing/sale-fixtures';

describe('quantitySchema', () => {
  test.each([1, 9999])('accepts %p', (value) => {
    expect(quantitySchema.safeParse(value).success).toBe(true);
  });

  test.each([0, 10000, 1.5, -1])('rejects %p', (value) => {
    expect(quantitySchema.safeParse(value).success).toBe(false);
  });
});

describe('saleItemInputSchema', () => {
  test('accepts a zero price (negotiable)', () => {
    expect(saleItemInputSchema.safeParse(makeItemInput(1, { unitPrice: clp(0) })).success).toBe(
      true,
    );
  });

  test.each([-1, 1_000_000_000])('rejects price %p', (price) => {
    expect(saleItemInputSchema.safeParse({ ...makeItemInput(), unitPrice: price }).success).toBe(
      false,
    );
  });

  test('accepts a null price', () => {
    expect(saleItemInputSchema.safeParse(makeItemInput()).success).toBe(true);
  });
});

describe('saleChannelSchema', () => {
  test('accepts the stable codes', () => {
    expect(saleChannelSchema.safeParse('fair').success).toBe(true);
  });

  test('rejects anything else', () => {
    expect(saleChannelSchema.safeParse('feria').success).toBe(false);
  });
});

describe('saleNoteSchema', () => {
  test('accepts 500 characters', () => {
    expect(saleNoteSchema.safeParse('a'.repeat(500)).success).toBe(true);
  });

  test('rejects 501 characters with too_long', () => {
    const result = saleNoteSchema.safeParse('a'.repeat(501));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('too_long');
  });

  test('normalizes whitespace-only text to null', () => {
    expect(saleNoteSchema.parse('   ')).toBeNull();
  });
});

describe('saveSaleRecordInputSchema', () => {
  const base = { soldOn: date('2026-07-01'), channel: null, note: null };

  test('accepts SALE_ITEMS_MAX items', () => {
    const items = Array.from({ length: SALE_ITEMS_MAX }, () => makeItemInput());

    expect(saveSaleRecordInputSchema.safeParse({ ...base, items }).success).toBe(true);
  });

  test('rejects more than SALE_ITEMS_MAX items', () => {
    const items = Array.from({ length: SALE_ITEMS_MAX + 1 }, () => makeItemInput());

    expect(saveSaleRecordInputSchema.safeParse({ ...base, items }).success).toBe(false);
  });

  test('accepts an empty list (the edit flow turns it into a delete)', () => {
    expect(saveSaleRecordInputSchema.safeParse({ ...base, items: [] }).success).toBe(true);
  });
});
