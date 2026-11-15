import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import type { AppDependencies } from '@/core/providers/app-dependencies';
import { DependenciesProvider } from '@/core/providers/dependencies-context';

/**
 * Wrapper de `renderHook` que entrega las dependencias de test y un `QueryClient` a los hooks
 * de `backup`. Sin `queryClient`, cada llamada crea uno nuevo.
 */
export function dependenciesWrapper(
  dependencies: AppDependencies,
  queryClient: QueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  }),
) {
  return function DependenciesWrapper({ children }: { readonly children: ReactNode }) {
    return (
      <DependenciesProvider dependencies={dependencies}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DependenciesProvider>
    );
  };
}
