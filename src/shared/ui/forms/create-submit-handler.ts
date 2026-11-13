import type { FieldValues, SubmitHandler, UseFormHandleSubmit } from 'react-hook-form';

import { announce } from '../announce';
import { FORM_ERRORS_ANNOUNCEMENT } from './error-messages';

/**
 * Builds the `onPress` of the primary button of a form. The button stays active
 * (design system 6.1): with valid data it calls `onValid`; otherwise React Hook Form marks
 * the fields, moves the focus to the first one with an error and the screen reader hears
 * "Revisa los campos marcados".
 */
export function createSubmitHandler<TInput extends FieldValues, TOutput extends FieldValues>(
  handleSubmit: UseFormHandleSubmit<TInput, TOutput>,
  onValid: SubmitHandler<TOutput>,
): () => void {
  return () => {
    void handleSubmit(onValid, () => {
      announce(FORM_ERRORS_ANNOUNCEMENT);
    })();
  };
}
