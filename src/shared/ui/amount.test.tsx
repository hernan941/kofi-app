import { screen } from '@testing-library/react-native';

import { clpSchema, signedClpSchema } from '@/shared/domain';

import { Amount } from './amount';
import { renderUi } from './testing/render-ui';

describe('Amount', () => {
  it('shows the CLP format and reads as pesos', async () => {
    await renderUi(<Amount value={clpSchema.parse(15000)} />);

    const amount = screen.getByLabelText('15.000 pesos');

    expect(amount).toHaveTextContent('$15.000');
  });

  it('reads negative amounts with "menos"', async () => {
    await renderUi(<Amount value={signedClpSchema.parse(-5000)} variant="list" />);

    expect(screen.getByLabelText('menos 5.000 pesos')).toHaveTextContent('-$5.000');
  });

  it('fits the display amount on one line and caps its font scale at 1.5', async () => {
    await renderUi(<Amount value={clpSchema.parse(1250000)} variant="display" />);

    const amount = screen.getByLabelText('1.250.000 pesos');

    expect(amount).toHaveProp('adjustsFontSizeToFit', true);
    expect(amount).toHaveProp('numberOfLines', 1);
    expect(amount).toHaveProp('maxFontSizeMultiplier', 1.5);
  });

  it('lets list amounts scale with the system font size', async () => {
    await renderUi(<Amount value={clpSchema.parse(990)} variant="list" />);

    expect(screen.getByLabelText('990 pesos')).not.toHaveProp('maxFontSizeMultiplier', 1.5);
  });

  it('shows the total variant as an accent heading amount on one line capped at 1.5', async () => {
    await renderUi(<Amount value={clpSchema.parse(45000)} variant="total" />);

    const amount = screen.getByLabelText('45.000 pesos');

    expect(amount).toHaveTextContent('$45.000');
    expect(amount).toHaveProp('numberOfLines', 1);
    expect(amount).toHaveProp('adjustsFontSizeToFit', true);
    expect(amount).toHaveProp('maxFontSizeMultiplier', 1.5);
    expect(amount).toHaveProp(
      'className',
      expect.stringMatching(/text-heading.*font-bold.*text-accent.*text-right/),
    );
  });
});
