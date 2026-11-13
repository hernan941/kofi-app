import { FakeClock } from '@/shared/domain/testing/fake-clock';

import {
  addVersion,
  archiveVersion,
  deleteVersion,
  firstVersionNameOnSplit,
  nextVersionPosition,
  removeVersion,
} from './version';
import { LATER, makeContext, makeProduct, makeVersion, NOW } from './testing/product-fixtures';

const newVersion = (name: string | null) => ({
  name,
  pricing: { mode: 'negotiable' as const },
  cost: null,
});

describe('firstVersionNameOnSplit', () => {
  test('defaults to Estándar', () => {
    expect(firstVersionNameOnSplit([null])).toBe('Estándar');
  });

  test('avoids a collision ignoring case and accents', () => {
    expect(firstVersionNameOnSplit(['estandar'])).toBe('Estándar 2');
    expect(firstVersionNameOnSplit(['Estándar', 'Estándar 2'])).toBe('Estándar 3');
  });
});

describe('nextVersionPosition', () => {
  test('is 0 without versions and max + 1 otherwise', () => {
    expect(nextVersionPosition(makeProduct([]))).toBe(0);
    expect(
      nextVersionPosition(makeProduct([makeVersion(0), makeVersion(4, { archivedAt: NOW })])),
    ).toBe(5);
  });
});

describe('addVersion', () => {
  test('renames the unnamed first version to Estándar when splitting', () => {
    const result = addVersion(makeProduct([makeVersion(0)]), newVersion('Print A3'), makeContext());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.versions.map((v) => v.name)).toEqual(['Estándar', 'Print A3']);
    expect(result.value.updatedAt).toBe(LATER);
  });

  test('picks Estándar 2 when the new name collides', () => {
    const result = addVersion(makeProduct([makeVersion(0)]), newVersion('estandar'), makeContext());
    expect(result.ok && result.value.versions.map((v) => v.name)).toEqual([
      'Estándar 2',
      'estandar',
    ]);
  });

  test('does not rename a first version that already has a name', () => {
    const result = addVersion(
      makeProduct([makeVersion(0, { name: 'A4' })]),
      newVersion('A3'),
      makeContext(),
    );
    expect(result.ok && result.value.versions.map((v) => v.name)).toEqual(['A4', 'A3']);
  });

  test('the new version needs a name', () => {
    const result = addVersion(makeProduct([makeVersion(0)]), newVersion(null), makeContext());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.map((e) => e.code)).toContain('version_name_required');
  });

  test('position is max + 1 including archived versions', () => {
    const product = makeProduct([
      makeVersion(0, { name: 'A' }),
      makeVersion(7, { name: 'B', archivedAt: NOW }),
    ]);
    const result = addVersion(product, newVersion('C'), makeContext());
    expect(result.ok && result.value.versions.at(-1)?.position).toBe(8);
  });
});

describe('archiveVersion', () => {
  const clock = new FakeClock(LATER);
  const v0 = makeVersion(0, { name: 'A' });
  const v1 = makeVersion(1, { name: 'B' });

  test('archives an active version', () => {
    const result = archiveVersion(makeProduct([v0, v1]), v1.id, clock);
    expect(result.ok && result.value.versions[1]?.archivedAt).toBe(LATER);
  });

  test('fails with no_active_version for the last one', () => {
    expect(archiveVersion(makeProduct([v0]), v0.id, clock)).toEqual({
      ok: false,
      error: [{ code: 'no_active_version', path: ['versions'] }],
    });
  });

  test('fails for unknown and already archived versions', () => {
    const archived = makeVersion(2, { archivedAt: NOW });
    const product = makeProduct([v0, archived]);
    const unknown = archiveVersion(product, makeVersion(9).id, clock);
    expect(!unknown.ok && unknown.error[0].code).toBe('version_not_found');
    const again = archiveVersion(product, archived.id, clock);
    expect(!again.ok && again.error[0].code).toBe('version_archived');
  });
});

describe('deleteVersion / removeVersion', () => {
  const v0 = makeVersion(0, { name: 'A' });
  const v1 = makeVersion(1, { name: 'B' });
  const product = makeProduct([v0, v1]);

  test('deleteVersion removes a version without sales', () => {
    const result = deleteVersion(product, v1.id, makeContext());
    expect(result.ok && result.value.versions).toEqual([v0]);
  });

  test('deleteVersion refuses a version with sales', () => {
    expect(deleteVersion(product, v1.id, makeContext([v1.id]))).toEqual({
      ok: false,
      error: [{ code: 'version_has_sales', path: [] }],
    });
  });

  test('removeVersion archives with sales and deletes without', () => {
    const archived = removeVersion(product, v1.id, makeContext([v1.id]));
    expect(archived.ok && archived.value.versions[1]?.archivedAt).toBe(LATER);
    const deleted = removeVersion(product, v1.id, makeContext());
    expect(deleted.ok && deleted.value.versions).toEqual([v0]);
  });

  test('removeVersion of the last active version fails', () => {
    const single = makeProduct([v0]);
    const result = removeVersion(single, v0.id, makeContext());
    expect(!result.ok && result.error[0].code).toBe('no_active_version');
  });

  test('removeVersion of an unknown version fails', () => {
    const result = removeVersion(product, makeVersion(9).id, makeContext());
    expect(!result.ok && result.error[0].code).toBe('version_not_found');
  });
});
