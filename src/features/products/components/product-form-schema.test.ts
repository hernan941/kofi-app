import { productVersionIdSchema } from '@/shared/domain';

import {
  applyProductErrors,
  productFormSchema,
  toProductFormValues,
  toSaveProductCommand,
  withAddedVersion,
  type PhotoFormValue,
  type ProductFormValues,
  type VersionFormValues,
} from './product-form-schema';
import { testPhotoId } from '../testing/in-memory-photo-storage';
import {
  PRODUCT_ID,
  clp,
  epoch,
  makeProduct,
  makeVersion,
} from '../domain/testing/product-fixtures';

const row = (overrides: Partial<VersionFormValues> = {}): VersionFormValues => ({
  versionId: null,
  name: '',
  pricingMode: 'fixed',
  priceText: '15.000',
  costText: '',
  costVisible: false,
  ...overrides,
});

const values = (
  versions: VersionFormValues[],
  overrides: Partial<ProductFormValues> = {},
): ProductFormValues => ({
  name: 'Lámina',
  description: '',
  versions,
  removedVersionIds: [],
  photos: [],
  ...overrides,
});

/** Issues as `path: code`. */
function issuesOf(input: ProductFormValues): readonly string[] {
  const result = productFormSchema.safeParse(input);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('productFormSchema', () => {
  it('turns the texts into the domain input', () => {
    const result = productFormSchema.parse(
      values([row({ costText: '3.000', costVisible: true })], { description: '  Acuarela ' }),
    );

    expect(result).toEqual({
      name: 'Lámina',
      description: 'Acuarela',
      versions: [{ name: null, pricing: { mode: 'fixed', price: 15000 }, cost: 3000 }],
      removedVersionIds: [],
      photos: [],
    });
  });

  it('ignores the price text when the price is negotiable and keeps the id of existing versions', () => {
    const versionId = '11111111-1111-7111-8111-000000000101';
    const result = productFormSchema.parse(
      values([row({ versionId, pricingMode: 'negotiable', priceText: 'abc' })]),
    );

    expect(result.versions[0]).toEqual({
      id: productVersionIdSchema.parse(versionId),
      name: null,
      pricing: { mode: 'negotiable' },
      cost: null,
    });
  });

  it('reports amount errors in their fields', () => {
    expect(issuesOf(values([row({ priceText: '' })]))).toEqual(['versions.0.priceText: empty']);
    expect(issuesOf(values([row({ costText: '15,5', costVisible: true })]))).toEqual([
      'versions.0.costText: comma_not_allowed',
    ]);
  });

  it('reports the name rules', () => {
    expect(issuesOf(values([row()], { name: '  ' }))).toEqual(['name: required']);
    expect(issuesOf(values([row({ name: 'A' }), row({ name: '' })]))).toEqual([
      'versions.1.name: version_name_required',
    ]);
    expect(issuesOf(values([row({ name: 'Print A4' }), row({ name: 'print  a4' })]))).toEqual([
      'versions.1.name: duplicate_version_name',
    ]);
  });
});

describe('withAddedVersion', () => {
  it('names the only unnamed row "Estándar" and appends an empty row', () => {
    const result = withAddedVersion(values([row()]));

    expect(result.versions.map((version) => version.name)).toEqual(['Estándar', '']);
    expect(result.versions[1]).toMatchObject({ versionId: null, pricingMode: 'fixed' });
  });

  it('does not rename a row that already has a name', () => {
    const result = withAddedVersion(values([row({ name: 'Print A4' })]));

    expect(result.versions.map((version) => version.name)).toEqual(['Print A4', '']);
  });
});

describe('toProductFormValues', () => {
  it('is an empty single fixed row when creating', () => {
    expect(toProductFormValues(null)).toEqual(values([row({ priceText: '' })], { name: '' }));
  });

  it('keeps only active versions and shows the cost when there is one', () => {
    const product = makeProduct(
      [
        makeVersion(0, { name: 'A4', cost: clp(3000) }),
        makeVersion(1, { name: 'Vieja', archivedAt: epoch(1) }),
        makeVersion(2, { name: 'Pers.', pricing: { mode: 'negotiable' } }),
      ],
      { description: 'Texto' },
    );

    const result = toProductFormValues(product);

    expect(result.description).toBe('Texto');
    expect(result.versions).toEqual([
      row({
        versionId: product.versions[0]?.id ?? null,
        name: 'A4',
        priceText: '1.000',
        costText: '3.000',
        costVisible: true,
      }),
      row({
        versionId: product.versions[2]?.id ?? null,
        name: 'Pers.',
        pricingMode: 'negotiable',
        priceText: '',
      }),
    ]);
  });
});

const photoValue = (n: number, isNew = false): PhotoFormValue => ({
  photoId: testPhotoId(n),
  width: 100,
  height: 50,
  byteSize: 10,
  sha256: 'c'.repeat(64),
  isNew,
});

describe('photos in the form', () => {
  it('turns the photo rows into the stored photos in the same order', () => {
    const result = productFormSchema.parse(
      values([row()], { photos: [photoValue(2, true), photoValue(1)] }),
    );

    expect(result.photos).toEqual([
      { id: testPhotoId(2), width: 100, height: 50, byteSize: 10, sha256: 'c'.repeat(64) },
      { id: testPhotoId(1), width: 100, height: 50, byteSize: 10, sha256: 'c'.repeat(64) },
    ]);
  });

  it('starts from the ordered photos of the product, none of them new', () => {
    const photo = (n: number, position: number) => ({
      id: testPhotoId(n),
      productId: PRODUCT_ID,
      position,
      width: 100,
      height: 50,
      byteSize: 10,
      sha256: 'c'.repeat(64),
    });
    const product = makeProduct([makeVersion(0)], { photos: [photo(1, 1), photo(2, 0)] });

    expect(toProductFormValues(product).photos).toEqual([photoValue(2), photoValue(1)]);
    expect(toProductFormValues(null).photos).toEqual([]);
  });

  it('passes the photos to the command', () => {
    const output = productFormSchema.parse(values([row()], { photos: [photoValue(1, true)] }));

    expect(toSaveProductCommand(null, output)).toMatchObject({ photos: output.photos });
    expect(toSaveProductCommand(PRODUCT_ID, output)).toMatchObject({ photos: output.photos });
  });
});

describe('toSaveProductCommand', () => {
  it('creates without ids and updates with the product id', () => {
    const output = productFormSchema.parse(values([row()]));

    expect(toSaveProductCommand(null, output).kind).toBe('create');
    expect(toSaveProductCommand(PRODUCT_ID, output)).toMatchObject({
      kind: 'update',
      productId: PRODUCT_ID,
    });
  });
});

describe('applyProductErrors', () => {
  it('sets the errors with a field and returns the rest', () => {
    const setError = jest.fn();

    const rest = applyProductErrors(
      [
        { code: 'required', path: ['name'] },
        { code: 'duplicate_version_name', path: ['versions', 1, 'name'] },
        { code: 'no_active_version', path: ['versions'] },
        { code: 'product_not_found', path: [] },
      ],
      setError,
    );

    expect(setError).toHaveBeenCalledWith('name', { message: 'required' }, { shouldFocus: true });
    expect(setError).toHaveBeenCalledWith(
      'versions.1.name',
      { message: 'duplicate_version_name' },
      { shouldFocus: false },
    );
    expect(rest.map((error) => error.code)).toEqual(['no_active_version', 'product_not_found']);
  });
});
