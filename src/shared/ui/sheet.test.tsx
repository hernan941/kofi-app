import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Sheet } from './sheet';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

describe('Sheet', () => {
  it('shows its title and content and closes from the close button', async () => {
    const onClose = jest.fn();
    await renderUi(
      <Sheet isOpen title="Elige la versión" onClose={onClose}>
        <Text>Print A4</Text>
      </Sheet>,
    );

    await user.press(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.getByRole('header', { name: 'Elige la versión' })).toBeOnTheScreen();
    expect(screen.getByText('Print A4')).toBeOnTheScreen();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with the Android back button', async () => {
    const onClose = jest.fn();
    await renderUi(
      <Sheet isOpen title="Elige la versión" onClose={onClose}>
        <Text>Print A4</Text>
      </Sheet>,
    );

    void fireEvent(
      screen.getByTestId('sheet-modal', { includeHiddenElements: true }),
      'requestClose',
    );

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
