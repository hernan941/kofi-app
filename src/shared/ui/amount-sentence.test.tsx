import { screen } from '@testing-library/react-native';

import { clpSchema, signedClpSchema } from '@/shared/domain';

import { AmountSentence, sentenceLabel } from './amount-sentence';
import { renderUi } from './testing/render-ui';

describe('AmountSentence', () => {
  it('shows the amount formatted inside the sentence and reads it as pesos', async () => {
    await renderUi(
      <AmountSentence
        parts={[{ amount: clpSchema.parse(5000) }, ' más que a esta altura de la semana pasada.']}
      />,
    );

    const sentence = screen.getByLabelText(
      '5.000 pesos más que a esta altura de la semana pasada.',
    );

    expect(sentence).toHaveTextContent('$5.000 más que a esta altura de la semana pasada.');
  });

  it('shows a negative amount with a minus sign and reads it as "menos"', async () => {
    await renderUi(
      <AmountSentence
        parts={['Te quedaron aprox. ', { amount: signedClpSchema.parse(-5000) }, '.']}
      />,
    );

    expect(screen.getByLabelText('Te quedaron aprox. menos 5.000 pesos.')).toHaveTextContent(
      'Te quedaron aprox. -$5.000.',
    );
  });

  it('follows the system font size without a cap', async () => {
    await renderUi(<AmountSentence parts={['Hola']} />);

    expect(screen.getByText('Hola')).not.toHaveProp('maxFontSizeMultiplier');
    expect(screen.getByText('Hola')).not.toHaveProp('numberOfLines');
  });

  it('takes the muted tone and the small size', async () => {
    await renderUi(<AmountSentence parts={['Hola']} tone="muted" size="sm" />);

    expect(screen.getByText('Hola')).toHaveProp('className', expect.stringContaining('text-muted'));
    expect(screen.getByText('Hola')).toHaveProp('className', expect.stringContaining('text-sm'));
  });
});

describe('sentenceLabel', () => {
  it('joins the parts reading the amounts as pesos', () => {
    expect(sentenceLabel(['Vendiste ', { amount: clpSchema.parse(1) }, ' hoy.'])).toBe(
      'Vendiste 1 peso hoy.',
    );
  });
});
