import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';

import { dependenciesWrapper } from '../testing/dependencies-wrapper';
import { useExportBackup } from './use-export-backup';

describe('useExportBackup', () => {
  it('starts idle', async () => {
    const { result } = await renderHook(() => useExportBackup(), {
      wrapper: dependenciesWrapper(createTestDependencies()),
    });

    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('creates the backup, opens the share sheet and finishes done', async () => {
    const dependencies = createTestDependencies();
    const { result } = await renderHook(() => useExportBackup(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state).toEqual({ status: 'done' });
    expect(dependencies.fileSharer.shared).toHaveLength(1);
    expect(dependencies.fileSharer.shared[0]).toMatchObject({ mimeType: 'application/zip' });
  });

  it('shows the phase while it works', async () => {
    const dependencies = createTestDependencies();
    let release: () => void = () => undefined;
    jest.spyOn(dependencies.fileSharer, 'share').mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const { result } = await renderHook(() => useExportBackup(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    let finished: Promise<void> = Promise.resolve();
    await act(() => {
      finished = result.current.run();
    });

    await waitFor(() => {
      expect(result.current.state).toEqual({
        status: 'working',
        progress: { phase: 'sharing' },
      });
    });
    await act(async () => {
      release();
      await finished;
    });
    expect(result.current.state).toEqual({ status: 'done' });
  });

  it('fails with the reason when there is not enough space', async () => {
    const dependencies = createTestDependencies();
    dependencies.archiveIo.freeSpace = 0;
    const { result } = await renderHook(() => useExportBackup(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state).toMatchObject({
      status: 'failed',
      problem: { code: 'not_enough_space' },
    });
    expect(dependencies.fileSharer.shared).toEqual([]);
  });

  it('fails as unexpected, and logs it, when something throws', async () => {
    const dependencies = createTestDependencies();
    dependencies.fileSharer.shareFailure = new Error('no activity');
    const { result } = await renderHook(() => useExportBackup(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state).toEqual({ status: 'failed', problem: 'unexpected' });
  });

  it('clears a previous result with reset', async () => {
    const dependencies = createTestDependencies();
    const { result } = await renderHook(() => useExportBackup(), {
      wrapper: dependenciesWrapper(dependencies),
    });
    await act(async () => {
      await result.current.run();
    });

    await act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('keeps working when reset is called while the backup is still being created', async () => {
    const dependencies = createTestDependencies();
    let release: () => void = () => undefined;
    jest.spyOn(dependencies.fileSharer, 'share').mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    const { result } = await renderHook(() => useExportBackup(), {
      wrapper: dependenciesWrapper(dependencies),
    });
    let finished: Promise<void> = Promise.resolve();
    await act(() => {
      finished = result.current.run();
    });
    await waitFor(() => {
      expect(result.current.state).toMatchObject({ status: 'working' });
    });

    await act(() => {
      result.current.reset();
    });

    expect(result.current.state).toMatchObject({ status: 'working' });
    await act(async () => {
      release();
      await finished;
    });
    expect(result.current.state).toEqual({ status: 'done' });
  });
});
