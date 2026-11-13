import { EmptyState, GearIcon, Screen } from '@/shared/ui';

/** Provisional screen of the Ajustes tab; the real one arrives with its feature. */
export function SettingsScreen() {
  return (
    <Screen>
      <EmptyState
        icon={GearIcon}
        title="Ajustes"
        description="Aquí podrás cuidar tus recordatorios y tus respaldos."
      />
    </Screen>
  );
}
