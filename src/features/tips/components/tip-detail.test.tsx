import { screen } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { BUNDLED_TIPS } from '../domain';
import { makeTip } from '../domain/testing/tip-fixtures';
import { TipDetail } from './tip-detail';

describe('TipDetail', () => {
  it('shows the title as a header and the whole body, selectable and without buttons', async () => {
    const tip = makeTip('costos-uno', { title: 'Cuenta tu tiempo', body: 'Suma tu tiempo.' });

    await renderUi(<TipDetail tip={tip} />);

    expect(screen.getByRole('header', { name: 'Cuenta tu tiempo' })).toBeOnTheScreen();
    expect(screen.getByText('Suma tu tiempo.').props.selectable).toBe(true);
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('reads the amounts of the body as pesos and keeps the visible text', async () => {
    const tip = makeTip('costos-uno', {
      title: 'Cuenta',
      body: 'Si una lámina cuesta $15.000 y la dejaste en $1.',
    });

    await renderUi(<TipDetail tip={tip} />);

    const body = screen.getByText('Si una lámina cuesta $15.000 y la dejaste en $1.');

    expect(body).toHaveAccessibleName('Si una lámina cuesta 15.000 pesos y la dejaste en 1 peso.');
  });

  it.each(BUNDLED_TIPS.map((tip) => [tip.id, tip] as const))(
    'the bundled tip %s is read without a dollar sign',
    async (_id, tip) => {
      await renderUi(<TipDetail tip={tip} />);

      expect(String(screen.getByText(tip.body).props.accessibilityLabel)).not.toContain('$');
    },
  );
});
