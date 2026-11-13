import { Skeleton } from 'heroui-native';
import { View } from 'react-native';

/** Shape of the placeholders: list rows or whole cards. */
export type LoadingShape = 'rows' | 'cards';

/** Props of {@link LoadingState}. */
export interface LoadingStateProps {
  readonly label: string;
  readonly shape?: LoadingShape;
  readonly count?: number;
}

const SHAPE_CLASSES: Readonly<Record<LoadingShape, string>> = {
  rows: 'min-h-14 rounded-xl bg-surface',
  cards: 'min-h-32 rounded-3xl bg-surface',
};

/**
 * Loading placeholder (design system 6.8): HeroUI `Skeleton` blocks with the shape of the
 * content, in card color, with the pulse animation that HeroUI turns off when the system
 * reduces motion. The screen reader finds a busy progress indicator named by `label`
 * ("Cargando ventas").
 */
export function LoadingState({ label, shape = 'rows', count = 3 }: LoadingStateProps) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      className="gap-3 px-4 pt-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} variant="pulse" className={SHAPE_CLASSES[shape]} />
      ))}
    </View>
  );
}
