import { createDataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { at, tipId } from '../domain/testing/tip-fixtures';
import { createInMemoryTipViewRepository } from '../testing/in-memory-tip-view-repository';
import { runTipViewRepositoryContract } from './tip-view-repository.contract';

describe('createInMemoryTipViewRepository', () => {
  runTipViewRepositoryContract(() => {
    const logger = new RecordingLogger();
    const dataChanges = createDataChanges(logger);
    const emitted: ReadonlySet<TableName>[] = [];
    dataChanges.subscribe((tables) => {
      emitted.push(tables);
    });
    return {
      repository: createInMemoryTipViewRepository({ dataChanges, logger }),
      emitted,
      dispose: () => undefined,
    };
  });
});

describe('createInMemoryTipViewRepository with invalid rows', () => {
  it('skips a row with an invalid id and logs a warning instead of failing', async () => {
    const logger = new RecordingLogger();
    const valid = tipId('costos-tu-tiempo');
    const repository = createInMemoryTipViewRepository({
      dataChanges: createDataChanges(logger),
      logger,
      initialRows: [{ tipId: 'Mal Id', firstSeenAt: at(5), lastSeenAt: at(5) }],
    });
    await repository.markSeen(valid, at(10));

    await expect(repository.listAll()).resolves.toEqual([
      { tipId: valid, firstSeenAt: at(10), lastSeenAt: at(10) },
    ]);
    expect(logger.entries).toEqual([
      { level: 'warn', event: 'tip_view_row_discarded', context: { tipId: 'Mal Id' } },
    ]);
  });
});
