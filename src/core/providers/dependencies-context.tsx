import { createContext, useContext, type ReactNode } from 'react';

import type { AppDependencies } from './app-dependencies';

const DependenciesContext = createContext<AppDependencies | null>(null);

/** Props de {@link DependenciesProvider}. */
export interface DependenciesProviderProps {
  readonly dependencies: AppDependencies;
  readonly children: ReactNode;
}

/** Entrega las dependencias de la raíz de composición a toda la UI. */
export function DependenciesProvider({ dependencies, children }: DependenciesProviderProps) {
  return <DependenciesContext value={dependencies}>{children}</DependenciesContext>;
}

/**
 * Dependencias de la app.
 * @throws {Error} Si se usa fuera de {@link DependenciesProvider}.
 */
export function useDependencies(): AppDependencies {
  const dependencies = useContext(DependenciesContext);
  if (dependencies === null) {
    throw new Error('useDependencies must be used inside DependenciesProvider');
  }
  return dependencies;
}
