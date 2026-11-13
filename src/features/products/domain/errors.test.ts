import * as domain from './index';
import { PRODUCT_ERROR_CODES } from './errors';

describe('PRODUCT_ERROR_CODES', () => {
  test('has no duplicates', () => {
    expect(new Set(PRODUCT_ERROR_CODES).size).toBe(PRODUCT_ERROR_CODES.length);
  });

  test('exposes the stable codes of the design', () => {
    expect([...PRODUCT_ERROR_CODES].sort()).toEqual(
      [
        'required',
        'too_long',
        'version_name_required',
        'duplicate_version_name',
        'no_active_version',
        'version_not_found',
        'version_archived',
        'version_has_sales',
        'product_not_found',
        'too_many_photos',
        'duplicate_photo',
        'photo_not_found',
      ].sort(),
    );
  });
});

describe('domain public API', () => {
  test('exports no Spanish UI text except the default first version name', () => {
    const strings = Object.entries(domain).filter(([, value]) => typeof value === 'string');
    expect(Object.fromEntries(strings)).toEqual(
      expect.objectContaining({ DEFAULT_FIRST_VERSION_NAME: 'Estándar' }),
    );
    expect(strings.map(([name]) => name).sort()).toEqual(['DEFAULT_FIRST_VERSION_NAME']);
  });
});
