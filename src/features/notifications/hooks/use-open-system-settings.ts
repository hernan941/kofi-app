import { Linking } from 'react-native';

import { useDependencies } from '@/core/providers/dependencies-context';

/** Abre los ajustes de cuantovendi en el teléfono; un fallo queda en el logger. */
export function useOpenSystemSettings(): () => void {
  const { logger } = useDependencies();
  return () => {
    Linking.openSettings().catch((error: unknown) => {
      logger.error('open_system_settings_failed', error);
    });
  };
}
