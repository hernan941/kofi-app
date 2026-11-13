import { screen, userEvent } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { ConfirmDialog } from './confirm-dialog';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

/** Captures the hardware back listeners so a test can press the Android back button. */
function captureBackButton(): () => void {
  const listeners: BackListener[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
    listeners.push(listener);
    return {
      remove: () => {
        listeners.splice(listeners.indexOf(listener), 1);
      },
    };
  });
  return () => {
    [...listeners]
      .reverse()
      .some((listener) => listener({ type: 'hardwareBackPress', timeStamp: 0 }));
  };
}

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

  it('closes with the Android back button', async () => {
    const pressBack = captureBackButton();
    const { view, onCancel } = renderDialog();
    await view;

    pressBack();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while closed', async () => {
    const { view } = renderDialog({ isOpen: false });
    await view;

    expect(screen.queryByText('¿Borrar esta venta?')).not.toBeOnTheScreen();
  });
});
