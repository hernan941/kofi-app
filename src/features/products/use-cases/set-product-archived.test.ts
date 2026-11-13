import type { TableName } from '@/core/db/table-names';
import type { TestDatabase } from '@/core/db/testing/test-database';
import { productIdSchema } from '@/shared/domain';
import { createFileLock } from '@/core/files/file-lock';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';
import { FakeClock } from '@/shared/domain/testing/fake-clock';
import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';

import { InMemoryPhotoStorage } from '../testing/in-memory-photo-storage';
import { createProductTestContext } from '../data/testing/create-product-test-context';
import {
  LATER,
  PRODUCT_ID,
  fixtureId,
  makeProduct,
  makeVersion,
} from '../domain/testing/product-fixtures';
import type { ProductRepository, ProductWriter } from '../data/product-repository';
import type { ProductCommandDeps } from './product-command-deps';
import { setProductArchived } from './set-product-archived';

let database: TestDatabase;
let emitted: ReadonlySet<TableName>[];
let repository: ProductRepository & ProductWriter;
let deps: ProductCommandDeps;

beforeEach(async () => {
  const context = await createProductTestContext();
  ({ database, repository, emitted } = context);
  deps = {
    transactions: database.transactions,
    products: repository,
    clock: new FakeClock(LATER),
    ids: new SequentialIdGenerator(),
    photos: new InMemoryPhotoStorage(),
    fileLock: createFileLock(),
    logger: new RecordingLogger(),
  };
  await repository.save(makeProduct([makeVersion(0, { name: 'A' })]));
  emitted.length = 0;
});

afterEach(() => {
  database.close();
});

describe('setProductArchived', () => {
  it('archives and unarchives the product', async () => {
    const archived = await setProductArchived(deps, { productId: PRODUCT_ID, archived: true });
    const afterArchive = await repository.findById(PRODUCT_ID);
    const restored = await setProductArchived(deps, { productId: PRODUCT_ID, archived: false });
    const afterRestore = await repository.findById(PRODUCT_ID);

    expect(archived.ok).toBe(true);
    expect(restored.ok).toBe(true);
    expect(afterArchive).toMatchObject({ archivedAt: LATER, updatedAt: LATER });
    expect(afterRestore).toMatchObject({ archivedAt: null });
    expect(emitted).toEqual([new Set(['products']), new Set(['products'])]);
  });

  it('does not write or emit when the state does not change', async () => {
    const result = await setProductArchived(deps, { productId: PRODUCT_ID, archived: false });

    expect(result.ok).toBe(true);
    expect(emitted).toEqual([]);
    await setProductArchived(deps, { productId: PRODUCT_ID, archived: true });
    emitted.length = 0;
    await setProductArchived(deps, { productId: PRODUCT_ID, archived: true });
    expect(emitted).toEqual([]);
  });

  it('returns product_not_found for a missing product', async () => {
    const result = await setProductArchived(deps, {
      productId: productIdSchema.parse(fixtureId(9)),
      archived: true,
    });

    expect(result).toEqual({ ok: false, error: [{ code: 'product_not_found', path: [] }] });
    expect(emitted).toEqual([]);
  });

  it('returns no_active_version when unarchiving a product without active versions', async () => {
    await repository.save(
      makeProduct([makeVersion(0, { name: 'A', archivedAt: LATER })], {
        archivedAt: LATER,
        updatedAt: LATER,
      }),
    );
    emitted.length = 0;

    const result = await setProductArchived(deps, { productId: PRODUCT_ID, archived: false });

    expect(result).toEqual({
      ok: false,
      error: [{ code: 'no_active_version', path: ['versions'] }],
    });
    expect(emitted).toEqual([]);
  });
});
