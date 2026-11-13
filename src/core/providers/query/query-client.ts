import { QueryClient } from '@tanstack/react-query';

/**
 * Crea el `QueryClient` para datos locales (ADR-009): sin pausas por falta de red, sin
 * datos obsoletos (solo las escrituras propias invalidan), sin reintentos y sin refetch al
 * enfocar.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        staleTime: Infinity,
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: { networkMode: 'always' },
    },
  });
}
