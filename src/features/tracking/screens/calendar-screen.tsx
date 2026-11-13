import { CalendarBlankIcon, EmptyState, Screen } from '@/shared/ui';

/** Provisional screen of the Calendario tab; the real one arrives with its feature. */
export function CalendarScreen() {
  return (
    <Screen>
      <EmptyState
        icon={CalendarBlankIcon}
        title="Calendario"
        description="Aquí verás tus ventas día por día."
      />
    </Screen>
  );
}
