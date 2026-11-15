import { useDependencies } from '@/core/providers/dependencies-context';

/** Versión de la app (`appVersion` de las dependencias); `'unknown'` si no se pudo leer. */
export function useAppVersion(): string {
  return useDependencies().appVersion;
}
