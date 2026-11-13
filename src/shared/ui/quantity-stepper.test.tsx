import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';

import { QuantityStepper } from './quantity-stepper';
import { renderUi } from './testing/render-ui';

/** Dispara un evento y espera a que React termine de aplicarlo (en RNTL 14 `fireEvent` devuelve una promesa). */
async function settle(pending: Promise<unknown>) {
  await pending;
}

const user = userEvent.setup();

describe('QuantityStepper', () => {
  it('adds and removes one unit', async () => {
    const onChange = jest.fn();
    await renderUi(
      <QuantityStepper label="Cantidad" value={3} min={1} max={5} onChange={onChange} />,
    );

    await user.press(screen.getByRole('button', { name: 'Agregar uno' }));
    await user.press(screen.getByRole('button', { name: 'Quitar uno' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 4);
    expect(onChange).toHaveBeenNthCalledWith(2, 2);
  });

  it('does not go below the minimum and says so with the disabled state', async () => {
    const onChange = jest.fn();
    await renderUi(
      <QuantityStepper label="Cantidad" value={1} min={1} max={5} onChange={onChange} />,
    );

    const remove = screen.getByRole('button', { name: 'Quitar uno' });
    await user.press(remove);

    expect(remove).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Agregar uno' })).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not go above the maximum and says so with the disabled state', async () => {
    const onChange = jest.fn();
    await renderUi(
      <QuantityStepper label="Cantidad" value={5} min={1} max={5} onChange={onChange} />,
    );

    const add = screen.getByRole('button', { name: 'Agregar uno' });
    await user.press(add);

    expect(add).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('exposes the value as an adjustable control', async () => {
    const onChange = jest.fn();
    await renderUi(
      <QuantityStepper label="Cantidad" value={2} min={1} max={5} onChange={onChange} />,
    );

    const adjustable = screen.getByRole('adjustable', { name: 'Cantidad' });
    void fireEvent(adjustable, 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(3);
    });
    expect(adjustable).toHaveAccessibilityValue({ min: 1, max: 5, now: 2 });
  });

  describe('typing the value', () => {
    it('reports a typed quantity right away', async () => {
      const onChange = jest.fn();
      await renderUi(
        <QuantityStepper label="Cantidad" value={1} min={1} max={9999} onChange={onChange} />,
      );

      const field = screen.getByRole('adjustable', { name: 'Cantidad' });
      await settle(fireEvent.changeText(field, ''));
      await user.type(field, '40');

      expect(onChange).toHaveBeenLastCalledWith(40);
    });

    it('goes back to the last valid value when the field is left empty', async () => {
      const onChange = jest.fn();
      await renderUi(
        <QuantityStepper label="Cantidad" value={7} min={1} max={9999} onChange={onChange} />,
      );

      const field = screen.getByRole('adjustable', { name: 'Cantidad' });
      await settle(fireEvent.changeText(field, ''));
      await settle(fireEvent(field, 'blur'));

      expect(field).toHaveDisplayValue('7');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('goes back to the last valid value when 0 is typed', async () => {
      const onChange = jest.fn();
      await renderUi(
        <QuantityStepper label="Cantidad" value={3} min={1} max={9999} onChange={onChange} />,
      );

      const field = screen.getByRole('adjustable', { name: 'Cantidad' });
      await settle(fireEvent.changeText(field, ''));
      await user.type(field, '0');
      await settle(fireEvent(field, 'blur'));

      expect(field).toHaveDisplayValue('3');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps only digits, so a decimal is not a valid quantity', async () => {
      const onChange = jest.fn();
      await renderUi(
        <QuantityStepper label="Cantidad" value={3} min={1} max={9999} onChange={onChange} />,
      );

      const field = screen.getByRole('adjustable', { name: 'Cantidad' });
      await settle(fireEvent.changeText(field, ''));
      await user.type(field, '2.5');
      await settle(fireEvent(field, 'blur'));

      expect(onChange).toHaveBeenLastCalledWith(25);
    });

    it('caps a quantity above the maximum when leaving the field', async () => {
      const onChange = jest.fn();
      await renderUi(
        <QuantityStepper label="Cantidad" value={1} min={1} max={9999} onChange={onChange} />,
      );

      const field = screen.getByRole('adjustable', { name: 'Cantidad' });
      await settle(fireEvent.changeText(field, ''));
      await user.type(field, '12000');
      await settle(fireEvent(field, 'blur'));

      expect(onChange).toHaveBeenLastCalledWith(9999);
    });

    it('shows the new value after pressing the buttons while editing', async () => {
      const onChange = jest.fn();
      const { rerender } = await renderUi(
        <QuantityStepper label="Cantidad" value={3} min={1} max={9999} onChange={onChange} />,
      );
      const field = screen.getByRole('adjustable', { name: 'Cantidad' });

      await settle(fireEvent.changeText(field, ''));
      await user.press(screen.getByRole('button', { name: 'Agregar uno' }));
      await rerender(
        <QuantityStepper label="Cantidad" value={4} min={1} max={9999} onChange={onChange} />,
      );

      expect(onChange).toHaveBeenLastCalledWith(4);
      expect(field).toHaveDisplayValue('4');
    });

    it('uses the number pad and names the field for the screen reader', async () => {
      await renderUi(
        <QuantityStepper
          label="Cantidad"
          accessibilityLabel="Cantidad de Lámina Colibrí"
          value={2}
          onChange={jest.fn()}
        />,
      );

      const field = screen.getByRole('adjustable', { name: 'Cantidad de Lámina Colibrí' });

      expect(field).toHaveProp('keyboardType', 'number-pad');
      expect(field).toHaveDisplayValue('2');
    });
  });
});
