import { createDataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { PRODUCT_ID, epoch, makeProduct, makeVersion } from '../domain/testing/product-fixtures';
import { createInMemoryProductRepository } from '../testing/in-memory-product-repository';
import { runProductRepositoryContract } from './product-repository.contract';

const T1 = epoch(1_700_000_100_000);

describe('createInMemoryProductRepository', () => {
  describe('contract', () => {
    runProductRepositoryContract(() => {
      const repository = createInMemoryProductRepository({
        dataChanges: createDataChanges(new RecordingLogger()),
      });
      return {
        repository,
        addSale: (seed) => {
          repository.addSale(seed);
        },
        dispose: () => undefined,
      };
    });
  });

  describe('DataChanges', () => {
    let emitted: ReadonlySet<TableName>[];
    let repository: ReturnType<typeof createInMemoryProductRepository>;

    beforeEach(() => {
      const dataChanges = createDataChanges(new RecordingLogger());
      emitted = [];
      dataChanges.subscribe((tables) => {
        emitted.push(tables);
      });
      repository = createInMemoryProductRepository({ dataChanges });
    });

    it('emits products and product_versions when a version is written', async () => {
      await repository.save(makeProduct([makeVersion(0, { name: 'A' })]));

      expect(emitted).toEqual([new Set(['products', 'product_versions'])]);
    });

    it('emits only products when no version changed or when archiving', async () => {
      const product = makeProduct([makeVersion(0, { name: 'A' })]);
      await repository.save(product);
      emitted.length = 0;

      await repository.save({ ...product, name: 'Otro', updatedAt: T1 });
      await repository.setArchived(PRODUCT_ID, T1, T1);

      expect(emitted).toEqual([new Set(['products']), new Set(['products'])]);
    });

    it('does not emit on reads', async () => {
      await repository.save(makeProduct([makeVersion(0)]));
      emitted.length = 0;
      await repository.listActive();
      await repository.findById(PRODUCT_ID);
      repository.versionIdsWithSalesSync(PRODUCT_ID);

      expect(emitted).toEqual([]);
    });
  });
});
