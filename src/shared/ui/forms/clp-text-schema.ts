import { z } from 'zod';

import { parseClpInput } from '@/shared/domain';

/**
 * Form schema of a money field: takes the text of `MoneyField` and outputs a `Clp` with
 * `parseClpInput`, so the rules live only in the domain (ADR-010). On failure the issue
 * message is the stable `ClpInputError` code, which `FormAmountField` translates.
 */
export const clpTextSchema = z.string().transform((text, context) => {
  const parsed = parseClpInput(text);
  if (!parsed.ok) {
    context.addIssue({ code: 'custom', message: parsed.error });
    return z.NEVER;
  }
  return parsed.value;
});
