import { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { epochMsSchema } from '@/shared/domain';

import type { RestoreProgress } from '../domain/progress';
import type { DatabaseSnapshot } from '../domain/snapshot';
import { buildBackupArchive } from '../testing/backup-archive-builder';
import { dependenciesWrapper } from '../testing/dependencies-wrapper';
import {
  EMPTY_SNAPSHOT,
  itemRow,
  productRow,
  recordRow,
  versionRow,
} from '../testing/snapshot-fixtures';
import { backupKeys } from './query-keys';
import { useRestoreBackup } from './use-restore-backup';

const PICKED = 'file:///fake/cache/DocumentPicker/respaldo.zip';
const SNAPSHOT: DatabaseSnapshot = {
  ...EMPTY_SNAPSHOT,
  products: [productRow(1)],
  productVersions: [versionRow(1, 1)],
  saleRecords: [recordRow(1)],
  saleItems: [itemRow(1, 1, 1, 1)],
};

async function setUp(queryClient?: QueryClient) {
  const dependencies = createTestDependencies();
  const replaceAll = jest.fn<Promise<void>, [DatabaseSnapshot]>(() => Promise.resolve());
  const withStore = createTestDependencies({
    ...dependencies,
    backupStore: {
      readSnapshot: () => Promise.resolve(EMPTY_SNAPSHOT),
      countActive: () => Promise.resolve({ products: 0, saleRecords: 0, activePhotos: 0 }),
      replaceAll,
    },
  });
  withStore.archiveIo.put(PICKED, await buildBackupArchive({ snapshot: SNAPSHOT }));
  withStore.documentPicker.picked = { uri: PICKED, name: 'respaldo.zip', size: 10 };
  const utils = await renderHook(() => useRestoreBackup(), {
    wrapper: dependenciesWrapper(withStore, queryClient),
  });
  return { dependencies: withStore, replaceAll, ...utils };
}

describe('useRestoreBackup', () => {
  it('starts idle', async () => {
    const { result } = await setUp();

    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('stays idle, without a problem, when the picker is cancelled', async () => {
    const { result, dependencies } = await setUp();
    dependencies.documentPicker.picked = null;

    await act(async () => {
      await result.current.pickFile();
    });

    expect(result.current.state).toEqual({ status: 'idle' });
    expect(dependencies.documentPicker.requests).toEqual([['*/*']]);
  });

  it('shows the preview of a valid backup with what is there and what it brings', async () => {
    const { result } = await setUp();

    await act(async () => {
      await result.current.pickFile();
    });

    expect(result.current.state).toMatchObject({
      status: 'preview',
      source: 'file',
      plan: { preview: { products: 1, saleRecords: 1, activePhotos: 0 } },
    });
  });

  it('fails with a problem, and discards the copy, when the file is not a backup', async () => {
    const { result, dependencies } = await setUp();
    dependencies.archiveIo.put(PICKED, new Uint8Array([1, 2, 3, 4, 5, 6]));

    await act(async () => {
      await result.current.pickFile();
    });

    expect(result.current.state).toMatchObject({
      status: 'failed',
      source: 'file',
      problem: { code: 'not_a_backup' },
      afterConfirm: false,
    });
    expect(dependencies.backupFiles.discarded).toContain(PICKED);
  });

  it('fails as unexpected when the picker throws', async () => {
    const { result, dependencies } = await setUp();
    dependencies.documentPicker.failure = new Error('no picker');

    await act(async () => {
      await result.current.pickFile();
    });

    expect(result.current.state).toMatchObject({ status: 'failed', problem: 'unexpected' });
  });

  it('goes back to idle and discards the copy when the preview is cancelled', async () => {
    const { result, dependencies } = await setUp();
    await act(async () => {
      await result.current.pickFile();
    });

    await act(() => {
      result.current.cancel();
    });

    expect(result.current.state).toEqual({ status: 'idle' });
    expect(dependencies.backupFiles.discarded).toContain(PICKED);
  });

  it('discards the copy when the screen goes away on the preview', async () => {
    const { result, dependencies, unmount } = await setUp();
    await act(async () => {
      await result.current.pickFile();
    });

    await unmount();

    expect(dependencies.backupFiles.discarded).toContain(PICKED);
  });

  it('replaces the data on confirm, reporting each phase, and ends done', async () => {
    const { result, replaceAll } = await setUp();
    await act(async () => {
      await result.current.pickFile();
    });
    const phases: RestoreProgress['phase'][] = [];

    await act(async () => {
      await result.current.confirm((progress) => {
        phases.push(progress.phase);
      });
    });

    expect(replaceAll).toHaveBeenCalledTimes(1);
    expect(replaceAll.mock.calls[0]?.[0].products).toHaveLength(1);
    expect(phases).toContain('applying');
    expect(result.current.state).toMatchObject({
      status: 'done',
      source: 'file',
      preview: { products: 1 },
    });
  });

  it('invalidates the latest safety backup after confirming, since restoring writes one', async () => {
    const queryClient = new QueryClient();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await setUp(queryClient);
    await act(async () => {
      await result.current.pickFile();
    });

    await act(async () => {
      await result.current.confirm();
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: backupKeys.latestSafety() });
  });

  it('fails after confirming, as unexpected, when applying throws', async () => {
    const { result, dependencies } = await setUp();
    await act(async () => {
      await result.current.pickFile();
    });
    jest.spyOn(dependencies.backupStore, 'replaceAll').mockRejectedValue(new Error('disk full'));

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.state).toMatchObject({
      status: 'failed',
      problem: 'unexpected',
      afterConfirm: true,
    });
  });

  it('fails after confirming with the problem the restoration reports', async () => {
    const { result, dependencies } = await setUp();
    await act(async () => {
      await result.current.pickFile();
    });
    dependencies.archiveIo.freeSpace = 0;

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.state).toMatchObject({
      status: 'failed',
      problem: { code: 'not_enough_space' },
      afterConfirm: true,
    });
  });

  it('ignores a confirm that does not come from the preview', async () => {
    const { result, replaceAll } = await setUp();

    await act(async () => {
      await result.current.confirm();
    });

    expect(replaceAll).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('restores the safety backup through a copy in the cache', async () => {
    const { result, dependencies } = await setUp();
    const safetyUri = 'file:///fake/doc/safety/cuantovendi-seguridad-1800000000123.zip';
    dependencies.backupFiles.safety = {
      uri: safetyUri,
      createdAt: epochMsSchema.parse(1_800_000_000_123),
    };
    dependencies.archiveIo.put(safetyUri, await buildBackupArchive({ snapshot: SNAPSHOT }));

    await act(async () => {
      await result.current.restoreSafety();
    });

    expect(result.current.state).toMatchObject({
      status: 'preview',
      source: 'safety',
      plan: { sourceUri: dependencies.backupFiles.restoreCopyTarget() },
    });
    expect(dependencies.archiveIo.files.has(safetyUri)).toBe(true);
  });

  it('does nothing when there is no safety backup', async () => {
    const { result } = await setUp();

    await act(async () => {
      await result.current.restoreSafety();
    });

    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('lets the person pick again after a problem and reset it', async () => {
    const { result, dependencies } = await setUp();
    dependencies.archiveIo.put(PICKED, new Uint8Array([1, 2, 3, 4, 5, 6]));
    await act(async () => {
      await result.current.pickFile();
    });

    await act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({ status: 'idle' });
  });

  describe('double taps', () => {
    it('ignores a second pickFile while the first is running', async () => {
      const { result, dependencies } = await setUp();

      await act(async () => {
        await Promise.all([result.current.pickFile(), result.current.pickFile()]);
      });

      expect(dependencies.documentPicker.requests).toHaveLength(1);
      expect(dependencies.backupFiles.discarded).toEqual([]);
      expect(result.current.state).toMatchObject({ status: 'preview', source: 'file' });
    });

    it('ignores a second restoreSafety while the first is running', async () => {
      const { result, dependencies } = await setUp();
      const safetyUri = 'file:///fake/doc/safety/cuantovendi-seguridad-1800000000123.zip';
      dependencies.backupFiles.safety = {
        uri: safetyUri,
        createdAt: epochMsSchema.parse(1_800_000_000_123),
      };
      dependencies.archiveIo.put(safetyUri, await buildBackupArchive({ snapshot: SNAPSHOT }));
      const copyTarget = jest.spyOn(dependencies.backupFiles, 'restoreCopyTarget');

      await act(async () => {
        await Promise.all([result.current.restoreSafety(), result.current.restoreSafety()]);
      });

      expect(copyTarget).toHaveBeenCalledTimes(1);
      expect(dependencies.backupFiles.discarded).toEqual([]);
      expect(result.current.state).toMatchObject({ status: 'preview', source: 'safety' });
    });

    it('ignores a second confirm while the first is running', async () => {
      const { result, dependencies, replaceAll } = await setUp();
      await act(async () => {
        await result.current.pickFile();
      });
      const acquire = jest.spyOn(dependencies.fileLock, 'acquire');

      await act(async () => {
        await Promise.all([result.current.confirm(), result.current.confirm()]);
      });

      expect(acquire).toHaveBeenCalledTimes(1);
      expect(replaceAll).toHaveBeenCalledTimes(1);
      expect(dependencies.backupFiles.discarded).toEqual([PICKED]);
      expect(result.current.state).toMatchObject({ status: 'done' });
    });

    it('lets the person act again once the previous action ends', async () => {
      const { result, dependencies } = await setUp();
      await act(async () => {
        await result.current.pickFile();
      });
      await act(() => {
        result.current.cancel();
      });

      await act(async () => {
        await result.current.pickFile();
      });

      expect(dependencies.documentPicker.requests).toHaveLength(2);
      expect(result.current.state).toMatchObject({ status: 'preview' });
    });
  });
});
