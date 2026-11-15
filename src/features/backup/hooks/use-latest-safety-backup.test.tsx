import { QueryClient } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { epochMsSchema } from '@/shared/domain';

import { Text } from 'react-native';

import { backupKeys } from './query-keys';
import { dependenciesWrapper } from '../testing/dependencies-wrapper';
import { useLatestSafetyBackup } from './use-latest-safety-backup';

const SAFETY = { uri: 'file:///fake/doc/safety/a.zip', createdAt: epochMsSchema.parse(5) };

function SafetyProbe() {
  const { data } = useLatestSafetyBackup();
  return <Text>{`copia: ${data === undefined || data === null ? 'ninguna' : data.uri}`}</Text>;
}

describe('useLatestSafetyBackup', () => {
  it('gives null when there is no safety backup', async () => {
    const dependencies = createTestDependencies();
    const { result } = await renderHook(() => useLatestSafetyBackup(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it('gives the latest safety backup', async () => {
    const dependencies = createTestDependencies();
    dependencies.backupFiles.safety = SAFETY;
    const { result } = await renderHook(() => useLatestSafetyBackup(), {
      wrapper: dependenciesWrapper(dependencies),
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(SAFETY);
    });
  });

  it('reads again when its key is invalidated', async () => {
    const dependencies = createTestDependencies();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } },
    });
    await render(<SafetyProbe />, { wrapper: dependenciesWrapper(dependencies, queryClient) });
    await screen.findByText('copia: ninguna');

    dependencies.backupFiles.safety = SAFETY;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: backupKeys.latestSafety() });
    });

    expect(await screen.findByText('copia: file:///fake/doc/safety/a.zip')).toBeOnTheScreen();
  });
});
