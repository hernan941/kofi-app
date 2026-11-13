import { createDataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { createInMemoryNoSalesWeekRepository } from '../testing/in-memory-no-sales-week-repository';
import { runNoSalesWeekRepositoryContract } from './no-sales-week-repository.contract';

describe('createInMemoryNoSalesWeekRepository', () => {
  runNoSalesWeekRepositoryContract(() => {
    const dataChanges = createDataChanges(new RecordingLogger());
    const emitted: ReadonlySet<TableName>[] = [];
    dataChanges.subscribe((tables) => {
      emitted.push(tables);
    });
    return {
      repository: createInMemoryNoSalesWeekRepository({ dataChanges }),
      emitted,
      dispose: () => undefined,
    };
  });
});
