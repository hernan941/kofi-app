import type { ReactNode } from 'react';
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { Pressable, Text, View } from 'react-native';

import { formatClpAccessible, type Clp, type SignedClp } from '@/shared/domain';

import { Amount } from './amount';
import { Icon } from './icon';

/** Props of {@link ListRow}. */
export interface ListRowProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Decorative 16 pt icon drawn before the subtitle (for example `Check` next to "Visto"). */
  readonly subtitleIcon?: PhosphorIcon;
  readonly amount?: Clp | SignedClp;
  readonly amountPrefix?: string;
  readonly leading?: ReactNode;
  /** Decorative node drawn at the end of the row, such as a `CaretRight`. */
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
}

/** Default label of a row: title, subtitle and amount in reading order. */
function rowLabel({ title, subtitle, amount, amountPrefix }: ListRowProps): string {
  const spokenAmount =
    amount === undefined
      ? undefined
      : [amountPrefix, formatClpAccessible(amount)].filter((part) => part !== undefined).join(' ');
  return [title, subtitle, spokenAmount].filter((part) => part !== undefined).join(', ');
}

/** Content of a row, shared by the pressable and the static versions. */
function RowContent({
  title,
  subtitle,
  subtitleIcon,
  amount,
  amountPrefix,
  leading,
  trailing,
}: ListRowProps) {
  return (
    <>
      {leading}
      <View className="min-w-40 flex-1 gap-0.5">
        <Text className="font-medium text-base text-foreground">{title}</Text>
        {subtitle === undefined ? null : (
          <View className="flex-row items-center gap-1">
            {subtitleIcon === undefined ? null : (
              <Icon icon={subtitleIcon} size="sm" color="muted" />
            )}
            <Text className="flex-1 font-medium text-xs text-muted">{subtitle}</Text>
          </View>
        )}
      </View>
      {amount === undefined ? null : (
        <View className="ml-auto flex-row flex-wrap items-baseline justify-end gap-1">
          {amountPrefix === undefined ? null : (
            <Text className="font-medium text-xs text-muted">{amountPrefix}</Text>
          )}
          <Amount value={amount} variant="list" isGrouped />
        </View>
      )}
      {trailing}
    </>
  );
}

const ROW_CONTENT_CLASSES = 'min-h-14 flex-row flex-wrap items-center gap-3 py-3';

/**
 * Hides the content of the row from the screen reader: the row already carries the full
 * label, so reading the parts again would add a second stop on Android.
 */
function HiddenRowContent(props: ListRowProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={ROW_CONTENT_CLASSES}
    >
      <RowContent {...props} />
    </View>
  );
}

/**
 * Row of a list inside a card (design system 6.4): optional leading thumbnail (40 × 40,
 * `rounded-xl`), name and secondary line, and the amount in its own right column, in text
 * color. With a large font the amount wraps below the name instead of being cut. When it
 * can be pressed, the whole row is a single button whose label sums it up ("Lámina
 * Colibrí, Print A4 · hoy, 15.000 pesos"); the screen may pass a better ordered label. The
 * parts inside are hidden from the screen reader, so the row is one stop.
 */
export function ListRow(props: ListRowProps) {
  if (props.onPress === undefined) {
    return (
      <View accessible accessibilityLabel={props.accessibilityLabel ?? rowLabel(props)}>
        <HiddenRowContent {...props} />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? rowLabel(props)}
      accessibilityHint={props.accessibilityHint}
      onPress={props.onPress}
    >
      <HiddenRowContent {...props} />
    </Pressable>
  );
}

/** Decorative 1 pt line between the rows of a list. */
export function ListSeparator() {
  return <View className="h-px bg-separator" />;
}
