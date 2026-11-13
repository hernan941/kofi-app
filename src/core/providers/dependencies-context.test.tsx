import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';

import { DependenciesProvider, useDependencies } from './dependencies-context';

describe('useDependencies', () => {
  test('returns the dependencies given to the provider', async () => {
    const dependencies = createTestDependencies();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DependenciesProvider dependencies={dependencies}>{children}</DependenciesProvider>
    );

    const { result } = await renderHook(() => useDependencies(), { wrapper });

    expect(result.current).toBe(dependencies);
  });

  test('fails with a clear message outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useDependencies())).rejects.toThrow(
      'useDependencies must be used inside DependenciesProvider',
    );
  });
});
