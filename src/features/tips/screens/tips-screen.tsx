import { EmptyState, LightbulbIcon, Screen } from '@/shared/ui';

/** Provisional screen of the Consejos tab; the real one arrives with its feature. */
export function TipsScreen() {
  return (
    <Screen>
      <EmptyState
        icon={LightbulbIcon}
        title="Consejos"
        description="Aquí encontrarás ideas breves para vender mejor."
      />
    </Screen>
  );
}
