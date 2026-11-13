import { Text } from 'react-native';

import { formatClp, formatClpAccessible, type Clp, type SignedClp } from '@/shared/domain';

/**
 * Where the amount appears: `display` is the main amount of a screen, `total` is the main
 * amount of a fixed footer (smaller than `display`), `list` goes in its own right-aligned
 * column of a row and `inline` sits inside regular text.
 */
export type AmountVariant = 'display' | 'total' | 'list' | 'inline';

/** Props of {@link Amount}. */
export interface AmountProps {
  readonly value: Clp | SignedClp;
  readonly variant?: AmountVariant;
}

const VARIANT_CLASSES: Readonly<Record<AmountVariant, string>> = {
  display: 'text-display font-bold tracking-tight text-accent',
  total: 'text-heading font-bold text-accent text-right',
  list: 'text-right text-lg font-bold text-foreground',
  inline: 'text-base font-semibold text-foreground',
};

const SINGLE_LINE_VARIANTS: ReadonlySet<AmountVariant> = new Set(['display', 'total']);
const CAPPED_MAX_FONT_SCALE = 1.5;

/**
 * The only way to show money in the app (design system 3.3, ADR-014). Formats CLP without
 * `Intl` (`$15.000`) and reads it as "15.000 pesos". The display and total variants shrink to
 * fit a single line and stop growing at 1.5 times the base size; the others follow the system
 * font size without limit. Amounts are never animated digit by digit.
 */
export function Amount({ value, variant = 'inline' }: AmountProps) {
  const isSingleLine = SINGLE_LINE_VARIANTS.has(variant);
  return (
    <Text
      accessible
      accessibilityLabel={formatClpAccessible(value)}
      className={VARIANT_CLASSES[variant]}
      numberOfLines={isSingleLine ? 1 : undefined}
      adjustsFontSizeToFit={isSingleLine}
      maxFontSizeMultiplier={isSingleLine ? CAPPED_MAX_FONT_SCALE : undefined}
    >
      {formatClp(value)}
    </Text>
  );
}
