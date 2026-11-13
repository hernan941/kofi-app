import { Text } from 'react-native';

import { formatClp, formatClpAccessible, type Clp, type SignedClp } from '@/shared/domain';

/** A piece of an {@link AmountSentence}: plain text or an amount. */
export type SentencePart = string | { readonly amount: Clp | SignedClp };

/** Props of {@link AmountSentence}. */
export interface AmountSentenceProps {
  readonly parts: readonly SentencePart[];
  readonly tone?: 'foreground' | 'muted';
  readonly size?: 'sm' | 'base';
}

const TONE_CLASSES = { foreground: 'text-foreground', muted: 'text-muted' } as const;
const SIZE_CLASSES = { sm: 'text-sm', base: 'text-base' } as const;

function spokenPart(part: SentencePart): string {
  return typeof part === 'string' ? part : formatClpAccessible(part.amount);
}

/** The sentence as a screen reader reads it: amounts in pesos ("5.000 pesos más que…"). */
export function sentenceLabel(parts: readonly SentencePart[]): string {
  return parts.map(spokenPart).join('');
}

/**
 * A sentence with amounts inside it ("$5.000 más que a esta altura de la semana pasada."):
 * the amounts are formatted as CLP in semibold, and the screen reader reads them as pesos
 * ("5.000 pesos más que…"). The text follows the system font size without limit and wraps
 * onto several lines.
 */
export function AmountSentence({ parts, tone = 'foreground', size = 'base' }: AmountSentenceProps) {
  return (
    <Text
      accessibilityLabel={sentenceLabel(parts)}
      className={`${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]}`}
    >
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          part
        ) : (
          <Text key={index} className="font-semibold">
            {formatClp(part.amount)}
          </Text>
        ),
      )}
    </Text>
  );
}
