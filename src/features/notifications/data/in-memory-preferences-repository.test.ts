import { createDataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { createInMemoryPreferencesRepository } from '../testing/in-memory-preferences-repository';
import { runPreferencesRepositoryContract } from './preferences-repository.contract';

describe('createInMemoryPreferencesRepository', () => {
  runPreferencesRepositoryContract(() => {
    const dataChanges = createDataChanges(new RecordingLogger());
    const emitted: ReadonlySet<TableName>[] = [];
    dataChanges.subscribe((tables) => {
      emitted.push(tables);
    });
    return {
      repository: createInMemoryPreferencesRepository({ dataChanges }),
      emitted,
      dispose: () => undefined,
    };
  });
});
