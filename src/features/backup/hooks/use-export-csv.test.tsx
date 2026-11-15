import { act, renderHook } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';

import { dependenciesWrapper } from '../testing/dependencies-wrapper';
import { useExportCsv } from './use-export-csv';

describe('useExportCsv', () => {
  it('starts idle', async () => {
    const { result } = await renderHook(() => useExportCsv(), {
      wrapper: dependenciesWrapper(createTestDependencies()),
    });

    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it.each([
    ['sales', 'ventas.csv'],
    ['products', 'productos.csv'],
  ] as const)(
    'exports the %s sheet and opens the share sheet, even without data',
    async (kind, file) => {
      const dependencies = createTestDependencies();
      const { result } = await renderHook(() => useExportCsv(), {
        wrapper: dependenciesWrapper(dependencies),
      });

      await act(async () => {
        await result.current.run(kind);
      });

      expect(result.current.state).toEqual({ status: 'done', kind });
      expect(dependencies.fileSharer.shared).toHaveLength(1);
      expect(dependencies.fileSharer.shared[0]).toMatchObject({
        fileUri: expect.stringContaining(file) as unknown,
        mimeType: 'text/csv',
      });
    },
  );

  it('shows which sheet is being prepared', async () => {
    const dependencies = createTestDependencies();
    let release: () => void = () => undefined;
    jest.spyOn(dependencies.fileSharer, 'isAvailable').mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = () => {
          resolve(true);
        };
      }),
    );
    const { result } = await renderHook(() => useExportCsv(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    let finished: Promise<void> = Promise.resolve();
    await act(() => {
      finished = result.current.run('products');
    });

    expect(result.current.state).toEqual({ status: 'working', kind: 'products' });
    await act(async () => {
      release();
      await finished;
    });
  });

  it('fails when the phone cannot share files', async () => {
    const dependencies = createTestDependencies();
    dependencies.fileSharer.available = false;
    const { result } = await renderHook(() => useExportCsv(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    await act(async () => {
      await result.current.run('sales');
    });

    expect(result.current.state).toEqual({
      status: 'failed',
      kind: 'sales',
      problem: { code: 'sharing_unavailable' },
    });
  });

  it('fails as unexpected when something throws', async () => {
    const dependencies = createTestDependencies();
    dependencies.fileSharer.shareFailure = new Error('no activity');
    const { result } = await renderHook(() => useExportCsv(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    await act(async () => {
      await result.current.run('sales');
    });

    expect(result.current.state).toEqual({
      status: 'failed',
      kind: 'sales',
      problem: 'unexpected',
    });
  });

  it('clears the result with reset', async () => {
    const { result } = await renderHook(() => useExportCsv(), {
      wrapper: dependenciesWrapper(createTestDependencies()),
    });
    await act(async () => {
      await result.current.run('sales');
    });

    await act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('keeps working when reset is called while the sheet is still being prepared', async () => {
    const dependencies = createTestDependencies();
    let release: () => void = () => undefined;
    jest.spyOn(dependencies.fileSharer, 'isAvailable').mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = () => {
          resolve(true);
        };
      }),
    );
    const { result } = await renderHook(() => useExportCsv(), {
      wrapper: dependenciesWrapper(dependencies),
    });
    let finished: Promise<void> = Promise.resolve();
    await act(() => {
      finished = result.current.run('sales');
    });

    await act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({ status: 'working', kind: 'sales' });
    await act(async () => {
      release();
      await finished;
    });
    expect(result.current.state).toEqual({ status: 'done', kind: 'sales' });
  });
});
