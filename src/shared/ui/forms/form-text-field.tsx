import {
  useController,
  type Control,
  type FieldError,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';

import { TextField, type TextFieldProps } from '../text-field';
import { describeWith, TEXT_ERROR_MESSAGES } from './error-messages';

/** Props of {@link FormTextField}. */
export interface FormTextFieldProps<
  TInput extends FieldValues,
  TOutput extends FieldValues,
  TName extends FieldPathByValue<TInput, string>,
> extends Omit<TextFieldProps, 'value' | 'onChangeText' | 'onBlur' | 'error' | 'ref'> {
  readonly control: Control<TInput, unknown, TOutput>;
  readonly name: TName;
  readonly describeError?: (error: FieldError) => string;
}

/**
 * {@link TextField} connected to React Hook Form with `useController` (ADR-009). It shows
 * the error of the field translated from its code (by default the codes of the text
 * schemas) and gives React Hook Form the input, so the focus can go to the first error.
 */
export function FormTextField<
  TInput extends FieldValues,
  TOutput extends FieldValues,
  TName extends FieldPathByValue<TInput, string>,
>({
  control,
  name,
  describeError = describeWith(TEXT_ERROR_MESSAGES),
  ...props
}: FormTextFieldProps<TInput, TOutput, TName>) {
  const {
    field: { ref: registerInput, value, onChange, onBlur },
    fieldState: { error },
  } = useController({ control, name });
  return (
    <TextField
      {...props}
      ref={registerInput}
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      onBlur={onBlur}
      error={error ? describeError(error) : undefined}
    />
  );
}
