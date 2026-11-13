import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import type { AppDependencies } from '@/core/providers/app-dependencies';
import { DependenciesProvider } from '@/core/providers/dependencies-context';
import { DataChangesBridge } from '@/core/providers/query/data-changes-bridge';
import { createQueryClient } from '@/core/providers/query/query-client';
import { QUERY_DEPENDENCIES } from '@/core/providers/query/query-dependencies';
import { UiTestProviders } from '@/shared/ui/testing/render-ui';

import { createTestDependencies } from './create-test-dependencies';

/**
 * `QueryClient` de la app sin temporizadores de recolección (`gcTime` infinito): en los tests
 * un temporizador pendiente impide que el proceso de Jest termine.
 */
function createTestQueryClient() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, gcTime: Infinity },
    mutations: { ...queryClient.getDefaultOptions().mutations, gcTime: Infinity },
  });
  return queryClient;
}

/** Opciones de {@link renderWithProviders}. */
export interface RenderWithProvidersOptions {
  readonly dependencies?: AppDependencies;
  /**
   * Conecta `DataChanges` con el `QueryClient` como lo hace la app (ADR-009): una escritura
   * recarga las consultas de las raíces que dependen de sus tablas. Por defecto, no.
   */
  readonly observeDataChanges?: boolean;
}

/**
 * Renderiza con RNTL dentro de los providers de test: gestos, HeroUI sin animaciones, un
 * `QueryClient` nuevo en cada llamada (ADR-009), sin temporizadores de recolección, y
 * `DependenciesProvider` con dobles. Con `observeDataChanges` también el puente que recarga las
 * consultas cuando una escritura avisa sus tablas.
 */
export function renderWithProviders(
  element: ReactElement,
  {
    dependencies = createTestDependencies(),
    observeDataChanges = false,
  }: RenderWithProvidersOptions = {},
) {
  const queryClient = createTestQueryClient();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <UiTestProviders>
        <DependenciesProvider dependencies={dependencies}>
          <QueryClientProvider client={queryClient}>
            {observeDataChanges ? (
              <DataChangesBridge
                dataChanges={dependencies.dataChanges}
                dependencies={QUERY_DEPENDENCIES}
              />
            ) : null}
            {children}
          </QueryClientProvider>
        </DependenciesProvider>
      </UiTestProviders>
    );
  }
  return render(element, { wrapper: Wrapper });
}
