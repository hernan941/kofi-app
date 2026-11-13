import { RecordingLogger } from '@/shared/lib/testing/recording-logger';

import { createDataChanges } from './data-changes';
import type { TableName } from './table-names';

describe('createDataChanges', () => {
  it('delivers emitted tables to every subscriber', () => {
    const changes = createDataChanges(new RecordingLogger());
    const first = jest.fn();
    const second = jest.fn();
    changes.subscribe(first);
    changes.subscribe(second);
    const tables = new Set<TableName>(['products', 'product_versions']);

    changes.emit(tables);

    expect(first).toHaveBeenCalledWith(tables);
    expect(second).toHaveBeenCalledWith(tables);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const changes = createDataChanges(new RecordingLogger());
    const listener = jest.fn();
    const unsubscribe = changes.subscribe(listener);

    unsubscribe();
    changes.emit(new Set<TableName>(['products']));

    expect(listener).not.toHaveBeenCalled();
  });

  it('tolerates a listener that unsubscribes while being notified', () => {
    const changes = createDataChanges(new RecordingLogger());
    const other = jest.fn();
    const unsubscribe = changes.subscribe(() => {
      unsubscribe();
    });
    changes.subscribe(other);

    changes.emit(new Set<TableName>(['sale_items']));

    expect(other).toHaveBeenCalledTimes(1);
  });

  it('isolates a listener that throws: the rest are notified and the error is logged', () => {
    const logger = new RecordingLogger();
    const changes = createDataChanges(logger);
    const failure = new Error('listener failed');
    const after = jest.fn();
    changes.subscribe(() => {
      throw failure;
    });
    changes.subscribe(after);

    expect(() => {
      changes.emit(new Set<TableName>(['products']));
    }).not.toThrow();

    expect(after).toHaveBeenCalledTimes(1);
    expect(logger.entriesAt('error')).toEqual([
      { level: 'error', event: 'data_changes_listener_failed', error: failure },
    ]);
  });
});
