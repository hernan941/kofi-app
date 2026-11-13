import { nextAmountText } from './amount-input';
import { TextField, type TextFieldProps } from './text-field';

/** Props of {@link MoneyField}; the value is the text shown, like `15.000`. */
export type MoneyFieldProps = Omit<TextFieldProps, 'prefix' | 'keyboardType' | 'inputMode'>;

/**
 * Money field (design system 6.3): number pad, fixed `$` prefix and thousands grouped
 * while typing. It keeps the amount as text; the form turns it into `Clp` with
 * `parseClpInput` (see `clpTextSchema`).
 */
export function MoneyField({ value, onChangeText, ...props }: MoneyFieldProps) {
  return (
    <TextField
      {...props}
      value={value}
      onChangeText={(text) => {
        onChangeText(nextAmountText(value, text));
      }}
      prefix="$"
      keyboardType="number-pad"
      inputMode="numeric"
    />
  );
}
