import { z } from 'zod';

import { clpTextSchema } from './clp-text-schema';

/**
 * Optional money field (for example the cost): empty or blank text becomes `null`; any other
 * text goes through {@link clpTextSchema}, so the rules stay in `parseClpInput`.
 */
export const optionalClpTextSchema = z.string().transform((text, context) => {
  if (text.trim() === '') {
    return null;
  }
  const parsed = clpTextSchema.safeParse(text);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      context.addIssue({ code: 'custom', message: issue.message });
    }
    return z.NEVER;
  }
  return parsed.data;
});
