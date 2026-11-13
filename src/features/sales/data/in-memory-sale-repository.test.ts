import { createDataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { runSaleRepositoryContract } from '../data/sale-repository.contract';
import { createInMemorySaleRepository } from '../testing/in-memory-sale-repository';

describe('createInMemorySaleRepository', () => {
  runSaleRepositoryContract(() => {
    const dataChanges = createDataChanges(new RecordingLogger());
    const emitted: ReadonlySet<TableName>[] = [];
    dataChanges.subscribe((tables) => {
      emitted.push(tables);
    });
    const repository = createInMemorySaleRepository({ dataChanges });
    return {
      repository,
      emitted,
      seedCatalog: () => Promise.resolve(),
      changeVersionCost: () => Promise.resolve(),
      seedRaw: (record) => {
        repository.seed(record);
      },
      dispose: () => undefined,
    };
  });
});
