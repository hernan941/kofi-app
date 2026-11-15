import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';
import { FakeClock } from '@/shared/domain/testing/fake-clock';

import {
  activeVersions,
  archiveProduct,
  compareProductsForList,
  createProduct,
  hasSingleActiveVersion,
  productListSortKey,
  unarchiveProduct,
  updateProduct,
} from './product';
import { clp, LATER, makeContext, makeProduct, makeVersion, NOW } from './testing/product-fixtures';
import type { CreateProductInput, UpdateProductInput, VersionEditInput } from './schemas';

const negotiable = { mode: 'negotiable' } as const;
const fixed = (price: number) => ({ mode: 'fixed', price: clp(price) }) as const;

describe('createProduct', () => {
  const context = { clock: new FakeClock(NOW), ids: new SequentialIdGenerator() };

  test('builds the aggregate with ids, positions and timestamps', () => {
    const input: CreateProductInput = {
      name: 'Lámina',
      description: null,
      versions: [
        { name: 'A4', pricing: fixed(5000), cost: null },
        { name: 'A3', pricing: negotiable, cost: clp(100) },
      ],
    };
    const result = createProduct(input, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const product = result.value;
    expect(product.createdAt).toBe(NOW);
    expect(product.updatedAt).toBe(NOW);
    expect(product.archivedAt).toBeNull();
    expect(product.photos).toEqual([]);
    expect(product.versions.map((v) => v.position)).toEqual([0, 1]);
    expect(product.versions.every((v) => v.productId === product.id && v.archivedAt === null)).toBe(
      true,
    );
    expect(new Set([product.id, ...product.versions.map((v) => v.id)]).size).toBe(3);
  });

  test('a single unnamed version is valid', () => {
    const result = createProduct(
      { name: 'x', description: null, versions: [{ name: null, pricing: negotiable, cost: null }] },
      context,
    );
    expect(result.ok).toBe(true);
  });

  test('two unnamed versions fail with a path per version', () => {
    const v = { name: null, pricing: negotiable, cost: null };
    const result = createProduct({ name: 'x', description: null, versions: [v, v] }, context);
    expect(result).toEqual({
      ok: false,
      error: [
        { code: 'version_name_required', path: ['versions', 0, 'name'] },
        { code: 'version_name_required', path: ['versions', 1, 'name'] },
      ],
    });
  });
});

describe('updateProduct', () => {
  const v0 = makeVersion(0, { name: 'A' });
  const v1 = makeVersion(1, { name: 'B' });
  const current = makeProduct([v0, v1]);
  const edit = (v: typeof v0, patch: Partial<VersionEditInput> = {}): VersionEditInput => ({
    id: v.id,
    name: v.name,
    pricing: v.pricing,
    cost: v.cost,
    ...patch,
  });
  const base = (
    versions: UpdateProductInput['versions'],
    removed: UpdateProductInput['removedVersionIds'] = [],
  ) =>
    ({
      name: 'Nuevo',
      description: 'd',
      versions,
      removedVersionIds: removed,
    }) as UpdateProductInput;

  test('edits names keeping positions, updatedAt and createdAt', () => {
    const result = updateProduct(
      current,
      base([edit(v0, { name: 'A2' }), edit(v1)]),
      makeContext(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Nuevo');
    expect(result.value.versions.map((v) => [v.name, v.position])).toEqual([
      ['A2', 0],
      ['B', 1],
    ]);
    expect(result.value.updatedAt).toBe(LATER);
    expect(result.value.createdAt).toBe(NOW);
  });

  test('swapping two names in one step is valid', () => {
    const result = updateProduct(
      current,
      base([edit(v0, { name: 'B' }), edit(v1, { name: 'A' })]),
      makeContext(),
    );
    expect(result.ok).toBe(true);
  });

  test('removing one and creating another with the same name is valid', () => {
    const result = updateProduct(
      current,
      base([edit(v0), { name: 'B', pricing: negotiable, cost: null }], [v1.id]),
      makeContext(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(activeVersions(result.value).map((v) => v.name)).toEqual(['A', 'B']);
    expect(result.value.versions.find((v) => v.id === v1.id)).toBeUndefined();
  });

  test('replacing the only active version in one step is valid', () => {
    const single = makeProduct([v0]);
    const result = updateProduct(
      single,
      base([{ name: null, pricing: negotiable, cost: null }], [v0.id]),
      makeContext(),
    );
    expect(result.ok).toBe(true);
  });

  test('removing every version fails with no_active_version', () => {
    const result = updateProduct(
      current,
      {
        ...base([{ name: null, pricing: negotiable, cost: null }]),
        versions: [],
        removedVersionIds: [v0.id, v1.id],
      },
      makeContext(),
    );
    expect(result).toEqual({
      ok: false,
      error: [{ code: 'no_active_version', path: ['versions'] }],
    });
  });

  test('removed versions with sales are archived, the rest are deleted', () => {
    const v2 = makeVersion(2, { name: 'C' });
    const three = makeProduct([v0, v1, v2]);
    const result = updateProduct(three, base([edit(v0)], [v1.id, v2.id]), makeContext([v1.id]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.versions.map((v) => v.id)).toEqual([v0.id, v1.id]);
    expect(result.value.versions[1]?.archivedAt).toBe(LATER);
  });

  test('editing an archived version fails with version_archived', () => {
    const archived = makeVersion(2, { name: 'C', archivedAt: NOW });
    const result = updateProduct(
      makeProduct([v0, archived]),
      base([edit(v0), edit(archived)]),
      makeContext(),
    );
    expect(result).toEqual({
      ok: false,
      error: [{ code: 'version_archived', path: ['versions', 1] }],
    });
  });

  test('a foreign id fails with version_not_found', () => {
    const foreign = makeVersion(9, { name: 'Z' });
    const result = updateProduct(current, base([edit(v0), edit(foreign)]), makeContext());
    expect(result).toEqual({
      ok: false,
      error: [{ code: 'version_not_found', path: ['versions', 1] }],
    });
  });

  test('a new version gets the next position without renumbering', () => {
    const result = updateProduct(
      makeProduct([v0, makeVersion(5, { name: 'Z', archivedAt: NOW })]),
      base([edit(v0), { name: 'N', pricing: negotiable, cost: null }]),
      makeContext(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.versions.map((v) => v.position)).toEqual([0, 5, 6]);
  });

  test('a product with repeated names must fix them', () => {
    const broken = makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'a' })]);
    const result = updateProduct(broken, base(broken.versions.map((v) => edit(v))), makeContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error[0].code).toBe('duplicate_version_name');
  });

  test('repeated names among new versions point at their own input index', () => {
    const result = updateProduct(
      current,
      base([
        edit(v0),
        { name: 'Dup', pricing: negotiable, cost: null },
        { name: 'dup', pricing: negotiable, cost: null },
      ]),
      makeContext(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.error.map((error) => error.path);
    expect(paths).toContainEqual(['versions', 2, 'name']);
  });

  test('an active version missing from the input is kept unchanged', () => {
    const result = updateProduct(current, base([edit(v0)]), makeContext());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.versions).toContainEqual(v1);
  });
});

describe('archiveProduct / unarchiveProduct', () => {
  const clock = new FakeClock(LATER);

  test('archive sets archivedAt and updatedAt', () => {
    const archived = archiveProduct(makeProduct([makeVersion(0)]), clock);
    expect(archived.archivedAt).toBe(LATER);
    expect(archived.updatedAt).toBe(LATER);
  });

  test('archive is idempotent and returns the same object', () => {
    const archived = makeProduct([makeVersion(0)], { archivedAt: NOW });
    expect(archiveProduct(archived, clock)).toBe(archived);
  });

  test('unarchive clears archivedAt', () => {
    const result = unarchiveProduct(makeProduct([makeVersion(0)], { archivedAt: NOW }), clock);
    expect(result.ok && result.value.archivedAt).toBeNull();
    expect(result.ok && result.value.updatedAt).toBe(LATER);
  });

  test('unarchive is idempotent', () => {
    const active = makeProduct([makeVersion(0)]);
    const result = unarchiveProduct(active, clock);
    expect(result.ok && result.value).toBe(active);
  });

  test('unarchive without active versions fails', () => {
    const product = makeProduct([makeVersion(0, { archivedAt: NOW })], { archivedAt: NOW });
    expect(unarchiveProduct(product, clock)).toEqual({
      ok: false,
      error: [{ code: 'no_active_version', path: ['versions'] }],
    });
  });
});

describe('tolerant readers', () => {
  const broken = makeProduct([
    makeVersion(0, { name: 'A', archivedAt: NOW }),
    makeVersion(1, { name: 'A' }),
  ]);
  const noActive = makeProduct([makeVersion(0, { archivedAt: NOW })]);

  test('activeVersions and hasSingleActiveVersion do not throw on broken data', () => {
    expect(activeVersions(noActive)).toEqual([]);
    expect(hasSingleActiveVersion(noActive)).toBe(false);
    expect(hasSingleActiveVersion(broken)).toBe(true);
    expect(
      hasSingleActiveVersion(
        makeProduct([makeVersion(0, { name: 'A' }), makeVersion(1, { name: 'A' })]),
      ),
    ).toBe(false);
  });

  test('activeVersions are ordered by position then id', () => {
    const product = makeProduct([makeVersion(2), makeVersion(1), makeVersion(1, { position: 2 })]);
    expect(activeVersions(product).map((v) => v.position)).toEqual([1, 2, 2]);
  });

  test('compareProductsForList sorts ignoring case and accents, ñ apart, then by createdAt', () => {
    const named = (name: string, createdAt = NOW) => makeProduct([], { name, createdAt });
    const names = [
      named('zeta'),
      named('Ñandú'),
      named('Árbol'),
      named('nube'),
      named('arbol', LATER),
    ]
      .sort(compareProductsForList)
      .map((p) => p.name);
    expect(names).toEqual(['Árbol', 'arbol', 'nube', 'Ñandú', 'zeta']);
  });
});

describe('productListSortKey', () => {
  test('orders names without case or accents and puts ñ after n', () => {
    const names = ['Ñandú', 'nube', 'Árbol', 'zorro', 'Nuez'];
    const sorted = [...names].sort((a, b) => {
      const keyA = productListSortKey(a);
      const keyB = productListSortKey(b);
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });
    expect(sorted).toEqual(['Árbol', 'nube', 'Nuez', 'Ñandú', 'zorro']);
  });
});
