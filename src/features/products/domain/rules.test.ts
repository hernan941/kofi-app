import { activeVersionIssues, validateProduct, versionNameIssues, versionNameKey } from './rules';
import { makeProduct, makeVersion } from './testing/product-fixtures';

describe('versionNameKey', () => {
  test.each([
    ['Print A4', 'print a4'],
    ['Lámina', 'lamina'],
    ['LÁMINA', 'lamina'],
    ['Print  A4 ', 'print a4'],
    ['Lámina', 'lamina'],
    ['Pingüino', 'pinguino'],
    ['Año', 'año'],
  ])('%p -> %p', (input, expected) => {
    expect(versionNameKey(input)).toBe(expected);
  });

  test('Año differs from Ano', () => {
    expect(versionNameKey('Año')).not.toBe(versionNameKey('Ano'));
  });
});

describe('versionNameIssues', () => {
  const entry = (name: string | null, i: number) => ({ name, path: ['versions', i, 'name'] });

  test('a single version may have no name', () => {
    expect(versionNameIssues([entry(null, 0)])).toEqual([]);
  });

  test('with two, a missing name is reported on its path', () => {
    expect(versionNameIssues([entry('A', 0), entry(null, 1)])).toEqual([
      { code: 'version_name_required', path: ['versions', 1, 'name'] },
    ]);
  });

  test('blank names count as missing', () => {
    expect(versionNameIssues([entry('A', 0), entry('  ', 1)])).toEqual([
      { code: 'version_name_required', path: ['versions', 1, 'name'] },
    ]);
  });

  test('duplicates ignoring case and accents flag all but the first', () => {
    expect(versionNameIssues([entry('Print A4', 0), entry('print a4', 1)])).toEqual([
      { code: 'duplicate_version_name', path: ['versions', 1, 'name'] },
    ]);
    expect(
      versionNameIssues([entry('Lámina', 0), entry('Lamina', 1), entry('LAMINA', 2)]),
    ).toHaveLength(2);
  });
});

describe('activeVersionIssues', () => {
  test('reports a product without active versions', () => {
    const product = makeProduct([makeVersion(0, { archivedAt: makeProduct([]).createdAt })]);
    expect(activeVersionIssues(product)).toEqual([
      { code: 'no_active_version', path: ['versions'] },
    ]);
  });

  test('is empty with one active version', () => {
    expect(activeVersionIssues(makeProduct([makeVersion(0)]))).toEqual([]);
  });
});

describe('validateProduct', () => {
  test('ok for a valid product', () => {
    expect(validateProduct(makeProduct([makeVersion(0)])).ok).toBe(true);
  });

  test('collects name and active version errors', () => {
    const result = validateProduct(
      makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'a' })]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error[0].code).toBe('duplicate_version_name');
    }
  });

  test('ignores archived versions for names', () => {
    const product = makeProduct([
      makeVersion(0, { name: 'A' }),
      makeVersion(1, { name: 'A', archivedAt: makeProduct([]).createdAt }),
    ]);
    expect(validateProduct(product).ok).toBe(true);
  });
});
