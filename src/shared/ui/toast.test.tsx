import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { PrimaryButton } from './primary-button';
import { renderUi } from './testing/render-ui';
import { useAppToast } from './toast';

const user = userEvent.setup();

function ToastProbe() {
  const toast = useAppToast();
  return (
    <>
      <PrimaryButton
        label="Guardar"
        onPress={() => {
          toast.showSuccess('Venta guardada');
        }}
      />
      <PrimaryButton
        label="Fallar"
        onPress={() => {
          toast.showError('No se pudo guardar. Inténtalo de nuevo');
        }}
      />
    </>
  );
}

/**
 * HeroUI renders each toast twice: the visible one first and a transparent copy that only
 * measures its height. The tests look at the visible one.
 */
async function findVisibleText(text: string) {
  const [visible] = await screen.findAllByText(text);
  return visible;
}

function visibleIcon(testId: string) {
  return screen.getAllByTestId(testId, { includeHiddenElements: true })[0];
}

describe('useAppToast', () => {
  it('shows a success toast with the check icon and announces it once', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderUi(<ToastProbe />);

    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(await findVisibleText('Venta guardada')).toBeVisible();
    expect(visibleIcon('phosphor-react-native-check-circle-fill')).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Venta guardada');
  });

  it('shows an error toast with the warning icon that can be closed', async () => {
    await renderUi(<ToastProbe />);

    await user.press(screen.getByRole('button', { name: 'Fallar' }));

    expect(await findVisibleText('No se pudo guardar. Inténtalo de nuevo')).toBeVisible();
    expect(visibleIcon('phosphor-react-native-warning-circle-bold')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Cerrar aviso' })[0]).toBeOnTheScreen();
  });
});
