import { useEffect, useRef } from 'react';
import { useFormState, type Control, type FieldValues } from 'react-hook-form';

/**
 * Returns a function that tells, when called from an effect, whether the render that is being
 * committed comes from the form being submitted. The submit handler already announces one
 * summary ("Revisa los campos marcados"), so the fields that get an error in that same commit
 * stay silent; an error that appears later (typing after a failed save) is announced by its
 * field. The children's effects run before this one updates the count, so they still see the
 * previous value.
 */
export function useIsFromSubmit<TInput extends FieldValues, TOutput extends FieldValues>(
  control: Control<TInput, unknown, TOutput>,
): () => boolean {
  const { submitCount } = useFormState({ control });
  const seenSubmitCount = useRef(submitCount);
  useEffect(() => {
    seenSubmitCount.current = submitCount;
  }, [submitCount]);
  return () => submitCount !== seenSubmitCount.current;
}
