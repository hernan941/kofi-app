import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { ConfirmDialog } from './confirm-dialog';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  const view = renderUi(
    <ConfirmDialog
      isOpen
      title="¿Borrar esta venta?"
      description="No se puede deshacer."
      confirmLabel="Borrar venta"
      isDestructive
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { view, onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('shows the question and calls onConfirm', async () => {
    const { view, onConfirm, onCancel } = renderDialog();
    await view;

    await user.press(screen.getByRole('button', { name: 'Borrar venta' }));

    expect(screen.getByText('¿Borrar esta venta?')).toBeOnTheScreen();
    expect(screen.getByText('No se puede deshacer.')).toBeOnTheScreen();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel from the cancel button', async () => {
    const { view, onConfirm, onCancel } = renderDialog();
    await view;

    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes with the Android back button of the modal window', async () => {
    const { view, onCancel } = renderDialog();
    await view;

    void fireEvent(
      screen.getByTestId('confirm-dialog-modal', { includeHiddenElements: true }),
      'requestClose',
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('moves the screen reader focus to the question when the modal shows', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const { view } = renderDialog();
    await view;

    void fireEvent(
      screen.getByTestId('confirm-dialog-modal', { includeHiddenElements: true }),
      'show',
    );

    expect(spy.mock.calls).toHaveLength(1);
    expect(spy.mock.calls[0]?.[1]).toBe('focus');
  });

  it('is a visible native modal so the screen reader stays inside it', async () => {
    const { view } = renderDialog();
    await view;

    const modal = screen.getByTestId('confirm-dialog-modal', { includeHiddenElements: true });

    expect(modal).toHaveProp('visible', true);
    expect(modal).toHaveProp('transparent', true);
  });

  it('marks the question as a header', async () => {
    const { view } = renderDialog();
    await view;

    expect(screen.getByRole('header', { name: '¿Borrar esta venta?' })).toBeOnTheScreen();
  });

  it('closes from the backdrop, which the screen reader does not reach', async () => {
    const { view, onCancel } = renderDialog();
    await view;

    await user.press(
      screen.getByTestId('confirm-dialog-backdrop', { includeHiddenElements: true }),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('confirm-dialog-backdrop')).not.toBeOnTheScreen();
  });

  it('reads the amounts of the description as pesos', async () => {
    const { view } = renderDialog({
      description: 'Se borra la venta por $45.000. No se puede deshacer.',
    });
    await view;

    const description = screen.getByText('Se borra la venta por $45.000. No se puede deshacer.');

    expect(description).toHaveAccessibleName(
      'Se borra la venta por 45.000 pesos. No se puede deshacer.',
    );
  });

  it('renders nothing while closed', async () => {
    const { view } = renderDialog({ isOpen: false });
    await view;

    expect(screen.queryByText('¿Borrar esta venta?')).not.toBeOnTheScreen();
  });
});
