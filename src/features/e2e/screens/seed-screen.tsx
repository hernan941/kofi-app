import { Text } from 'react-native';

import { Screen } from '@/shared/ui';

import type { E2eFixtureName } from '../domain/fixture-names';
import { useSeedFixture } from '../hooks/use-seed-fixture';

/** Props de {@link SeedScreen}. */
export interface SeedScreenProps {
  readonly fixture: E2eFixtureName;
  readonly materialize: (name: E2eFixtureName) => Promise<string>;
}

function messageFor(state: ReturnType<typeof useSeedFixture>, fixture: E2eFixtureName): string {
  switch (state.status) {
    case 'loading':
      return 'Cargando datos de prueba…';
    case 'done':
      return `Datos de prueba cargados: ${fixture}`;
    case 'failed':
      return `No se pudieron cargar los datos de prueba: ${state.reason}`;
  }
}

/**
 * Semilla de E2E (ADR-013), solo alcanzable en el build E2E: restaura un fixture del bundle y
 * muestra el texto que espera Maestro cuando termina.
 */
export function SeedScreen({ fixture, materialize }: SeedScreenProps) {
  const state = useSeedFixture(fixture, materialize);
  return (
    <Screen>
      <Text
        accessibilityRole="header"
        className="px-4 pt-4 font-semibold text-title text-foreground"
      >
        {messageFor(state, fixture)}
      </Text>
    </Screen>
  );
}
