import { QueryClientProvider } from '@tanstack/react-query';
import { HeroUINativeProvider } from 'heroui-native';
import { useState, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { AppComposition } from './app-dependencies';
import { DependenciesProvider } from './dependencies-context';
import { MigrationGate } from './migration-gate';
import { DataChangesBridge } from './query/data-changes-bridge';
import { createQueryClient } from './query/query-client';
import { QUERY_DEPENDENCIES } from './query/query-dependencies';

const ROOT_STYLE = { flex: 1 } as const;

/** Props de {@link AppProviders}. */
export interface AppProvidersProps {
  readonly composition: AppComposition;
  readonly children: ReactNode;
}

/**
 * Árbol de providers de la app (de afuera hacia adentro): raíz de gestos, HeroUI Native,
 * dependencias, puerta de arranque, `QueryClient` (ADR-009) y puente de invalidación. Los valores por defecto de
 * los íconos no pasan por `IconContext`: `Icon` de `shared/ui` fija tamaño y peso, y los
 * íconos importados uno por uno (`phosphor-react-native/src/icons/*`) no comparten el contexto
 * del paquete principal.
 */
export function AppProviders({ composition, children }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);
  const { dependencies } = composition;

  return (
    <GestureHandlerRootView style={ROOT_STYLE}>
      <HeroUINativeProvider>
        <DependenciesProvider dependencies={dependencies}>
          <MigrationGate
            migrateDatabase={composition.migrateDatabase}
            runAfterFirstRender={composition.runAfterFirstRender}
          >
            <QueryClientProvider client={queryClient}>
              <DataChangesBridge
                dataChanges={dependencies.dataChanges}
                dependencies={QUERY_DEPENDENCIES}
              />
              {children}
            </QueryClientProvider>
          </MigrationGate>
        </DependenciesProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
