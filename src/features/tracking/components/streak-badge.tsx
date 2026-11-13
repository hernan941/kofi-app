import { Text, View } from 'react-native';

import type { Streak } from '@/features/sales/domain';
import { Card, FireIcon, Icon } from '@/shared/ui';

/** Props of {@link StreakBadge}. */
export interface StreakBadgeProps {
  readonly streak: Streak;
  /** `compact` es la línea de Inicio; `full` es la tarjeta del Calendario. */
  readonly variant: 'compact' | 'full';
}

const ZERO_TITLE = 'Tu racha empieza cuando registras una semana';
const ZERO_HINT = 'Cuenta las semanas en que anotas ventas o marcas "no vendí".';

function weeksText(weeks: number, suffix: string): string {
  return weeks === 1 ? `1 semana${suffix}` : `${String(weeks)} semanas seguidas${suffix}`;
}

function CompactStreak({ weeks }: { readonly weeks: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`Racha: ${weeksText(weeks, ' registrando')}.`}
      className="min-h-12 flex-row items-center gap-2"
    >
      <Icon icon={FireIcon} size="md" color="accent" weight="fill" />
      <Text className="font-semibold text-sm text-accent">{weeksText(weeks, ' registrando')}</Text>
    </View>
  );
}

function FullStreak({ streak }: { readonly streak: Streak }) {
  const hasStreak = streak.weeks >= 1;
  const hint = hasStreak
    ? streak.includesCurrentWeek
      ? 'Semanas registrando, con ventas o con "no vendí".'
      : 'Esta semana suma cuando registres una venta o marques "no vendí".'
    : ZERO_HINT;
  const label = hasStreak
    ? `Racha: ${weeksText(streak.weeks, ' registrando')}.`
    : `${ZERO_TITLE}. ${ZERO_HINT.replaceAll('"', '')}`;
  return (
    <Card>
      <View accessible accessibilityLabel={label} className="flex-row items-center gap-3">
        <Icon
          icon={FireIcon}
          color={hasStreak ? 'accent' : 'muted'}
          weight={hasStreak ? 'fill' : 'bold'}
        />
        <View className="flex-1 gap-0.5">
          <Text
            className={`font-semibold text-heading ${hasStreak ? 'text-accent' : 'text-foreground'}`}
          >
            {hasStreak ? weeksText(streak.weeks, '') : ZERO_TITLE}
          </Text>
          <Text className="text-sm text-muted">{hint}</Text>
        </View>
      </View>
    </Card>
  );
}

/**
 * Racha de semanas seguidas (D-41). `compact` solo se dibuja con una semana o más: en Inicio
 * una racha en cero se leería como reproche. `full` siempre se dibuja y explica cómo empieza.
 */
export function StreakBadge({ streak, variant }: StreakBadgeProps) {
  if (variant === 'full') {
    return <FullStreak streak={streak} />;
  }
  return streak.weeks >= 1 ? <CompactStreak weeks={streak.weeks} /> : null;
}
