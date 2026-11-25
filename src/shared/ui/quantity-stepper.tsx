import { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { useState } from 'react';
import { Text, TextInput, View, type AccessibilityActionEvent } from 'react-native';

import { useFieldFocusReporting } from './form-layout';
import { IconButton } from './icon-button';

/** Props of {@link QuantityStepper}. */
export interface QuantityStepperProps {
  readonly label: string;
  /** Name read by the screen reader when the visible label is not enough, for example "Cantidad de Lámina Colibrí". */
  readonly accessibilityLabel?: string;
  /** Label of the "remove one" button; name the product when there are several rows. */
  readonly decrementLabel?: string;
  /** Label of the "add one" button; name the product when there are several rows. */
  readonly incrementLabel?: string;
  readonly value: number;
  /** Value as spoken, for example "8 horas"; defaults to the number. */
  readonly valueText?: string;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
}

const ADJUSTABLE_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

/** Digits only: a quantity is a whole number, so signs, dots and letters are dropped. */
function digitsOf(text: string): string {
  return text.replaceAll(/\D/g, '');
}

/**
 * Whole-number stepper ("Cantidad"): remove one, the value and add one. The value is also a
 * number field, so decenas can be typed instead of pressed. While typing, every quantity
 * between `min` and `max` is reported right away; on leaving the field, an empty, zero or
 * too small text goes back to the last valid value and one above `max` stays at `max`. The
 * buttons stop at `min` and `max` and say so with the disabled state. For the screen reader
 * the field is an adjustable control that responds to the swipe up and down gestures and reads
 * its value as text (`valueText`), because a range without text is read as a percentage.
 */
export function QuantityStepper({
  label,
  accessibilityLabel = label,
  decrementLabel = 'Quitar uno',
  incrementLabel = 'Agregar uno',
  value,
  valueText = String(value),
  onChange,
  min = 1,
  max = 99,
}: QuantityStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const { ref: fieldRef, notifyFocus, notifyBlur } = useFieldFocusReporting();
  const canDecrement = value > min;
  const canIncrement = value < max;
  const decrement = () => {
    setDraft(null);
    if (canDecrement) onChange(value - 1);
  };
  const increment = () => {
    setDraft(null);
    if (canIncrement) onChange(value + 1);
  };
  const handleAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') increment();
    if (event.nativeEvent.actionName === 'decrement') decrement();
  };
  const handleChangeText = (text: string) => {
    const digits = digitsOf(text);
    setDraft(digits);
    const typed = Number(digits);
    if (digits !== '' && typed >= min && typed <= max) onChange(typed);
  };
  const handleBlur = () => {
    notifyBlur();
    const typed = Number(draft ?? '');
    setDraft(null);
    if (draft !== null && draft !== '' && typed > max) onChange(max);
  };

  return (
    <View ref={fieldRef} collapsable={false} className="gap-2">
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="font-medium text-sm text-foreground"
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <IconButton
          icon={MinusIcon}
          accessibilityLabel={decrementLabel}
          onPress={decrement}
          isDisabled={!canDecrement}
        />
        <TextInput
          value={draft ?? String(value)}
          onChangeText={handleChangeText}
          onFocus={notifyFocus}
          onBlur={handleBlur}
          keyboardType="number-pad"
          inputMode="numeric"
          selectTextOnFocus
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ min, max, now: value, text: valueText }}
          accessibilityActions={ADJUSTABLE_ACTIONS}
          onAccessibilityAction={handleAction}
          className="bg-field-background min-h-12 min-w-16 rounded-field border-2 border-field-border px-3 text-center font-bold text-lg text-field-foreground"
        />
        <IconButton
          icon={PlusIcon}
          accessibilityLabel={incrementLabel}
          onPress={increment}
          isDisabled={!canIncrement}
        />
      </View>
    </View>
  );
}
