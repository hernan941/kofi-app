import {
  noSalesWeekIdSchema,
  productIdSchema,
  productPhotoIdSchema,
  productVersionIdSchema,
  saleItemIdSchema,
  saleRecordIdSchema,
  uuidSchema,
  type ProductId,
  type ProductVersionId,
} from './ids';
import { epochMsSchema } from './epoch-ms';

const VALID_UUID = '0197a5b2-7c3e-7a1b-8c4d-123456789abc';

describe('uuidSchema', () => {
  test('accepts a lowercase UUID', () => {
    expect(uuidSchema.safeParse(VALID_UUID).success).toBe(true);
  });

  test.each(['', 'not-a-uuid', VALID_UUID.toUpperCase(), VALID_UUID.slice(1), 42])(
    'rejects %p',
    (value) => {
      expect(uuidSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe.each([
  ['productIdSchema', productIdSchema],
  ['productVersionIdSchema', productVersionIdSchema],
  ['productPhotoIdSchema', productPhotoIdSchema],
  ['saleRecordIdSchema', saleRecordIdSchema],
  ['saleItemIdSchema', saleItemIdSchema],
  ['noSalesWeekIdSchema', noSalesWeekIdSchema],
])('%s', (_name, schema) => {
  test('accepts a UUID and rejects other text', () => {
    expect(schema.safeParse(VALID_UUID).success).toBe(true);
    expect(schema.safeParse('abc').success).toBe(false);
  });
});

describe('branded ids', () => {
  test('cannot be mixed at compile time', () => {
    const productId: ProductId = productIdSchema.parse(VALID_UUID);
    const versionId: ProductVersionId = productVersionIdSchema.parse(VALID_UUID);

    // @ts-expect-error a product id is not a version id
    const mixed: ProductVersionId = productId;

    expect([productId, versionId, mixed]).toHaveLength(3);
  });
});

describe('epochMsSchema', () => {
  test('accepts non-negative integers', () => {
    expect(epochMsSchema.safeParse(0).success).toBe(true);
    expect(epochMsSchema.safeParse(1_760_000_000_000).success).toBe(true);
  });

  test.each([-1, 1.5, Number.NaN])('rejects %p', (value) => {
    expect(epochMsSchema.safeParse(value).success).toBe(false);
  });
});
