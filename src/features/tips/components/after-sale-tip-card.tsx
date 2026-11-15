import { Text, View } from 'react-native';

import { Card, Icon, IconButton, LightbulbIcon, XIcon, spokenPesos } from '@/shared/ui';

import type { Tip } from '../domain';
import { TIP_CATEGORY_LABELS } from './category-labels';

/** Props of {@link AfterSaleTipCard}. */
export interface AfterSaleTipCardProps {
  readonly tip: Tip;
  readonly onClose: () => void;
}

/**
 * Tarjeta del consejo de la celebración (UX-T1, UX-T2): categoría, título y cuerpo completo,
 * alineados a la izquierda, y una X para cerrarla. No tiene enlaces ni otras acciones: la
 * única salida de la celebración sigue siendo "Listo". Es presentacional: no marca nada.
 * `IconButton` no acepta `hitSlop` (su área táctil ya es de 48 × 48), así que la fila lleva
 * márgenes negativos (`-mt-2 -mr-2`) para que la X quede alineada con el borde de la tarjeta.
 */
export function AfterSaleTipCard({ tip, onClose }: AfterSaleTipCardProps) {
  return (
    <View className="w-full pt-2">
      <Card>
        <View className="-mt-2 -mr-2 flex-row items-center gap-2">
          <Icon icon={LightbulbIcon} size="md" color="muted" />
          <Text className="flex-1 font-medium text-xs text-muted">
            {`Consejo · ${TIP_CATEGORY_LABELS[tip.category]}`}
          </Text>
          <IconButton icon={XIcon} accessibilityLabel="Cerrar consejo" onPress={onClose} />
        </View>
        <Text accessibilityRole="header" className="font-semibold text-heading text-foreground">
          {tip.title}
        </Text>
        <Text accessibilityLabel={spokenPesos(tip.body)} className="text-base text-foreground">
          {tip.body}
        </Text>
      </Card>
    </View>
  );
}
