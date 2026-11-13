import { screen, userEvent } from '@testing-library/react-native';

import { clpSchema } from '@/shared/domain';

import { ListRow } from './list-row';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

describe('ListRow', () => {
  it('is a single button whose label sums up the row', async () => {
    const onPress = jest.fn();
    await renderUi(
      <ListRow
        title="Lámina Colibrí"
        subtitle="Print A4 · hoy"
        amount={clpSchema.parse(15000)}
        onPress={onPress}
      />,
    );

    await user.press(
      screen.getByRole('button', { name: 'Lámina Colibrí, Print A4 · hoy, 15.000 pesos' }),
    );

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('accepts a label written by the screen', async () => {
    await renderUi(
      <ListRow
        title="Lámina Colibrí"
        amount={clpSchema.parse(15000)}
        accessibilityLabel="Lámina Colibrí, Print A4, 15.000 pesos, hoy"
        onPress={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Lámina Colibrí, Print A4, 15.000 pesos, hoy' }),
    ).toBeOnTheScreen();
  });

  it('is plain text when it cannot be pressed', async () => {
    await renderUi(<ListRow title="Costo" amount={clpSchema.parse(4000)} />);

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.getByText('$4.000')).toBeOnTheScreen();
  });

  it('shows the amount prefix and reads it in the default label', async () => {
    await renderUi(
      <ListRow
        title="Lámina Colibrí"
        subtitle="3 versiones"
        amount={clpSchema.parse(10000)}
        amountPrefix="desde"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('desde')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Lámina Colibrí, 3 versiones, desde 10.000 pesos' }),
    ).toBeOnTheScreen();
  });

  it('ignores the prefix when there is no amount', async () => {
    await renderUi(<ListRow title="Lámina" amountPrefix="desde" />);

    expect(screen.queryByText('desde')).not.toBeOnTheScreen();
  });

  it('passes an accessibility hint to the pressable row', async () => {
    await renderUi(
      <ListRow
        title="Lámina"
        onPress={jest.fn()}
        accessibilityHint="Abre el detalle de la venta"
      />,
    );

    expect(screen.getByRole('button', { name: 'Lámina' })).toHaveProp(
      'accessibilityHint',
      'Abre el detalle de la venta',
    );
  });
});
