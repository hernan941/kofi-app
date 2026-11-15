import { screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { clpSchema } from '@/shared/domain';

import { CheckIcon } from './icons';
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
    expect(screen.getByText('$4.000', { includeHiddenElements: true })).toBeOnTheScreen();
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

    expect(screen.getByText('desde', { includeHiddenElements: true })).toBeOnTheScreen();
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

  describe('subtitleIcon', () => {
    it('draws the icon before the subtitle without changing the label', async () => {
      await renderUi(
        <ListRow
          title="Cuánto cuesta tu tiempo"
          subtitle="Visto"
          subtitleIcon={CheckIcon}
          onPress={jest.fn()}
        />,
      );

      expect(
        screen.getByTestId('phosphor-react-native-check-bold', { includeHiddenElements: true }),
      ).toBeOnTheScreen();
      expect(screen.getByText('Visto', { includeHiddenElements: true })).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: 'Cuánto cuesta tu tiempo, Visto' }),
      ).toBeOnTheScreen();
    });

    it('draws no icon without the prop', async () => {
      await renderUi(<ListRow title="Cuánto cuesta tu tiempo" subtitle="Visto" />);

      expect(
        screen.queryByTestId('phosphor-react-native-check-bold', { includeHiddenElements: true }),
      ).not.toBeOnTheScreen();
    });
  });

  it('draws the trailing node at the end of a pressable row without changing its label', async () => {
    await renderUi(
      <ListRow
        title="Día y hora"
        subtitle="Domingos"
        onPress={jest.fn()}
        trailing={<Text>fin</Text>}
      />,
    );

    expect(screen.getByText('fin', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Día y hora, Domingos' })).toBeOnTheScreen();
  });

  it('hides its content from the screen reader so the row is a single stop', async () => {
    await renderUi(
      <ListRow
        title="Lámina Colibrí"
        subtitle="hoy"
        amount={clpSchema.parse(15000)}
        onPress={jest.fn()}
      />,
    );

    const row = screen.getByRole('button', { name: 'Lámina Colibrí, hoy, 15.000 pesos' });

    expect(screen.queryByLabelText('15.000 pesos')).not.toBeOnTheScreen();
    expect(screen.queryByText('Lámina Colibrí')).not.toBeOnTheScreen();
    expect(row).toBeOnTheScreen();
    expect(screen.getByText('$15.000', { includeHiddenElements: true })).toHaveProp(
      'accessible',
      false,
    );
  });

  it('is a single stop when static too', async () => {
    await renderUi(<ListRow title="Costo" amount={clpSchema.parse(4000)} />);

    expect(screen.getByLabelText('Costo, 4.000 pesos')).toBeOnTheScreen();
    expect(screen.queryByLabelText('4.000 pesos')).not.toBeOnTheScreen();
    expect(screen.queryByText('Costo')).not.toBeOnTheScreen();
  });
});
