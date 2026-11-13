import { SALE_ERROR_CODES, toSaleErrors } from './errors';

describe('SALE_ERROR_CODES', () => {
  test('has no duplicates', () => {
    expect(new Set(SALE_ERROR_CODES).size).toBe(SALE_ERROR_CODES.length);
  });

  test('are stable snake_case codes, not Spanish text', () => {
    for (const code of SALE_ERROR_CODES) {
      expect(code).toMatch(/^[a-z_]+$/);
    }
  });
});

describe('toSaleErrors', () => {
  test('returns null for an empty list', () => {
    expect(toSaleErrors([])).toBeNull();
  });

  test('returns the list when it has errors', () => {
    const error = { code: 'future_date', path: ['soldOn'] } as const;

    expect(toSaleErrors([error])).toEqual([error]);
  });
});
