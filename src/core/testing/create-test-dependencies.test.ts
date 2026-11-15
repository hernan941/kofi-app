import { createDataChanges } from '@/core/db/data-changes';
import type { TableName } from '@/core/db/table-names';
import { makeProduct, makeVersion } from '@/features/products/testing/product-fixtures';
import { RecordingLogger } from '@/shared/lib/testing/recording-logger';
import { SequentialIdGenerator } from '@/shared/domain/testing/sequential-id-generator';

import { createTestDependencies } from './create-test-dependencies';

describe('createTestDependencies', () => {
  it('uses deterministic doubles by default', () => {
    const dependencies = createTestDependencies();

    expect(dependencies.ids.next()).toBe('00000000-0000-7000-8000-000000000001');
    expect(dependencies.clock.now()).toBe(dependencies.clock.now());
    expect(dependencies.calendar.localDateOf(dependencies.clock.now())).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('applies overrides', () => {
    const ids = new SequentialIdGenerator();

    expect(createTestDependencies({ ids }).ids).toBe(ids);
  });

  it('provides the backup doubles so a backup can be exported without a device', async () => {
    const dependencies = createTestDependencies();

    await expect(dependencies.backupStore.readSnapshot()).resolves.toMatchObject({ products: [] });
    expect(dependencies.archiveIo.availableDiskSpace()).toBeGreaterThan(0);
    expect(dependencies.backupFiles.exportTarget('ventas.csv')).toContain('ventas.csv');
    await expect(dependencies.fileSharer.isAvailable()).resolves.toBe(true);
    expect(dependencies.appVersion).not.toBe('');
  });

  it('runs transactions inline and rejects with the error of the work', async () => {
    const { transactions } = createTestDependencies();

    await expect(transactions.run(() => 7)).resolves.toBe(7);
    await expect(
      transactions.run(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('connects the in-memory products to the same dataChanges and shares one store', async () => {
    const { products, productWriter, dataChanges } = createTestDependencies();
    const emitted: ReadonlySet<TableName>[] = [];
    dataChanges.subscribe((tables) => {
      emitted.push(tables);
    });

    productWriter.saveSync(makeProduct([makeVersion(0)]));

    expect(emitted).toEqual([new Set(['products', 'product_versions'])]);
    await expect(products.listActive()).resolves.toHaveLength(1);
  });

  it('connects the in-memory products to the dataChanges that an override provides', () => {
    const dataChanges = createDataChanges(new RecordingLogger());
    const emit = jest.spyOn(dataChanges, 'emit');
    const dependencies = createTestDependencies({ dataChanges });

    dependencies.productWriter.saveSync(makeProduct([makeVersion(0)]));

    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('logs the failures of the default dataChanges in the logger of the overrides', () => {
    const logger = new RecordingLogger();
    const dependencies = createTestDependencies({ logger });
    dependencies.dataChanges.subscribe(() => {
      throw new Error('listener boom');
    });

    dependencies.dataChanges.emit(new Set<TableName>(['products']));

    expect(logger.entriesAt('error').map((entry) => entry.event)).toEqual([
      'data_changes_listener_failed',
    ]);
  });
});
