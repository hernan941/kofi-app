import { ScrollView, Text } from 'react-native';

import { spokenPesos } from '@/shared/ui';

import type { Tip } from '../domain';

/** Props of {@link TipDetail}. */
export interface TipDetailProps {
  readonly tip: Tip;
}

/**
 * Lectura de un consejo (3.4): título y cuerpo completo, sin botones ni tarjetas. Los montos con
 * `$` del cuerpo se leen como pesos; el texto visible no cambia.
 */
export function TipDetail({ tip }: TipDetailProps) {
  return (
    <ScrollView contentContainerClassName="gap-4 px-4 pt-4 pb-6">
      <Text accessibilityRole="header" className="font-semibold text-title text-foreground">
        {tip.title}
      </Text>
      <Text
        selectable
        accessibilityLabel={spokenPesos(tip.body)}
        className="text-base text-foreground"
      >
        {tip.body}
      </Text>
    </ScrollView>
  );
}
