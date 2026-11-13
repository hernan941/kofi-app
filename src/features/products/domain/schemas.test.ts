import {
  createProductInputSchema,
  productDescriptionSchema,
  productNameSchema,
  updateProductInputSchema,
  versionCostSchema,
  versionNameSchema,
  versionPricingSchema,
} from './schemas';

describe('text schemas', () => {
  test('product name is trimmed and required', () => {
    expect(productNameSchema.parse('  Lámina ')).toBe('Lámina');
    const result = productNameSchema.safeParse('   ');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('required');
  });

  test('product name accepts 80 and rejects 81 after trimming', () => {
    expect(productNameSchema.safeParse(` ${'a'.repeat(80)} `).success).toBe(true);
    const result = productNameSchema.safeParse('a'.repeat(81));
    expect(result.error?.issues[0]?.message).toBe('too_long');
  });

  test('version name is optional and normalizes empty to null', () => {
    expect(versionNameSchema.parse('  ')).toBeNull();
    expect(versionNameSchema.parse(undefined)).toBeNull();
    expect(versionNameSchema.safeParse('a'.repeat(81)).success).toBe(false);
    expect(versionNameSchema.safeParse('a'.repeat(80)).success).toBe(true);
  });

  test('description accepts 1000 and rejects 1001', () => {
    expect(productDescriptionSchema.safeParse('a'.repeat(1000)).success).toBe(true);
    expect(productDescriptionSchema.safeParse('a'.repeat(1001)).success).toBe(false);
    expect(productDescriptionSchema.parse('')).toBeNull();
  });
});

describe('versionPricingSchema', () => {
  test('fixed requires a price and accepts zero', () => {
    expect(versionPricingSchema.safeParse({ mode: 'fixed' }).success).toBe(false);
    expect(versionPricingSchema.safeParse({ mode: 'fixed', price: 0 }).success).toBe(true);
  });

  test('negotiable carries no price', () => {
    const parsed = versionPricingSchema.parse({ mode: 'negotiable', price: 500 });
    expect(parsed).toEqual({ mode: 'negotiable' });
  });
});

describe('versionCostSchema', () => {
  test.each([null, 0, 999_999_999])('accepts %p', (value) => {
    expect(versionCostSchema.safeParse(value).success).toBe(true);
  });

  test.each([-1, 1.5, 1_000_000_000])('rejects %p', (value) => {
    expect(versionCostSchema.safeParse(value).success).toBe(false);
  });
});

describe('product input schemas', () => {
  const version = { name: null, pricing: { mode: 'negotiable' }, cost: null };

  test('create requires at least one version', () => {
    expect(
      createProductInputSchema.safeParse({ name: 'A', description: null, versions: [] }).success,
    ).toBe(false);
    expect(
      createProductInputSchema.safeParse({ name: 'A', description: null, versions: [version] })
        .success,
    ).toBe(true);
  });

  test('update requires at least one version and the removed ids', () => {
    const base = { name: 'A', description: null, versions: [version], removedVersionIds: [] };
    expect(updateProductInputSchema.safeParse(base).success).toBe(true);
    expect(updateProductInputSchema.safeParse({ ...base, versions: [] }).success).toBe(false);
  });
});
