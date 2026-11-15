import { screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { makeTip } from '../domain/testing/tip-fixtures';
import { AfterSaleTipCard } from './after-sale-tip-card';

const user = userEvent.setup();

const TIP = makeTip('costos-tu-tiempo', {
  category: 'costs',
  title: 'Cuenta tu tiempo',
  body: 'Anota cuánto demoras en hacer cada pieza y súmalo a tu costo.',
});

describe('AfterSaleTipCard', () => {
  it('shows the category, the title and the whole body', async () => {
    await renderUi(<AfterSaleTipCard tip={TIP} onClose={jest.fn()} />);

    expect(screen.getByText('Consejo · Costos')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Cuenta tu tiempo' })).toBeOnTheScreen();
    expect(screen.getByText(TIP.body)).toBeOnTheScreen();
    expect(screen.getByText(TIP.body).props).not.toHaveProperty('numberOfLines');
  });

  it('closes with the X button', async () => {
    const onClose = jest.fn();
    await renderUi(<AfterSaleTipCard tip={TIP} onClose={onClose} />);

    await user.press(screen.getByRole('button', { name: 'Cerrar consejo' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has no other button, so there is no way out that skips Listo', async () => {
    await renderUi(<AfterSaleTipCard tip={TIP} onClose={jest.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('link')).not.toBeOnTheScreen();
  });

  it('reads the amounts of the body as pesos', async () => {
    const tip = makeTip('costos-tu-tiempo', {
      title: 'Cuenta',
      body: 'Si vendes en $15.000 y cuesta $6.000.',
    });
    await renderUi(<AfterSaleTipCard tip={tip} onClose={jest.fn()} />);

    expect(screen.getByText('Si vendes en $15.000 y cuesta $6.000.')).toHaveAccessibleName(
      'Si vendes en 15.000 pesos y cuesta 6.000 pesos.',
    );
  });
});
