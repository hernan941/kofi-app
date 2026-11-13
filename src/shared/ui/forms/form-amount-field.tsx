import {
  useController,
  type Control,
  type FieldError,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';

import { MoneyField, type MoneyFieldProps } from '../money-field';
import { CLP_INPUT_ERROR_MESSAGES, describeWith } from './error-messages';

/** Props of {@link FormAmountField}. */
export interface FormAmountFieldProps<
  TInput extends FieldValues,
  TOutput extends FieldValues,
  TName extends FieldPathByValue<TInput, string>,
> extends Omit<MoneyFieldProps, 'value' | 'onChangeText' | 'onBlur' | 'error' | 'ref'> {
  readonly control: Control<TInput, unknown, TOutput>;
  readonly name: TName;
  readonly describeError?: (error: FieldError) => string;
}

/**
 * {@link MoneyField} connected to React Hook Form with `useController` (ADR-009). The form
 * keeps the text and validates it with `clpTextSchema`; the errors of `parseClpInput` are
 * shown with messages that say how to write the amount.
 */
export function FormAmountField<
  TInput extends FieldValues,
  TOutput extends FieldValues,
  TName extends FieldPathByValue<TInput, string>,
>({
  control,
  name,
  describeError = describeWith(CLP_INPUT_ERROR_MESSAGES),
  ...props
}: FormAmountFieldProps<TInput, TOutput, TName>) {
  const {
    field: { ref: registerInput, value, onChange, onBlur },
    fieldState: { error },
  } = useController({ control, name });
  return (
    <MoneyField
      {...props}
      ref={registerInput}
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      onBlur={onBlur}
      error={error ? describeError(error) : undefined}
    />
  );
}
