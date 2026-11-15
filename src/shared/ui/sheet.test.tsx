import { fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

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

  it('keeps the header outside a scroll area that holds the content and is height-limited', async () => {
    await renderUi(
      <Sheet isOpen title="Elige la versión" onClose={jest.fn()}>
        <Text>Print A4</Text>
      </Sheet>,
    );

    const scroll = screen.getByTestId('sheet-scroll');

    expect(within(scroll).getByText('Print A4')).toBeOnTheScreen();
    expect(within(scroll).queryByRole('header')).not.toBeOnTheScreen();
    expect(within(scroll).queryByRole('button', { name: 'Cerrar' })).not.toBeOnTheScreen();
    expect(scroll).toHaveProp('keyboardShouldPersistTaps', 'handled');
    expect(screen.getByTestId('sheet-card')).toHaveProp(
      'className',
      expect.stringContaining('max-h-[90%]'),
    );
  });

  it('leaves the content without a scroll area when it scrolls by itself', async () => {
    await renderUi(
      <Sheet isOpen title="Elige" onClose={jest.fn()} isScrollable={false}>
        <Text>Lista</Text>
      </Sheet>,
    );

    expect(screen.queryByTestId('sheet-scroll')).not.toBeOnTheScreen();
    expect(screen.getByText('Lista')).toBeOnTheScreen();
  });

  it('moves the screen reader focus to the title when focusKey changes, not on the first render', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const view = await renderUi(
      <Sheet isOpen title="¿Qué más vendiste?" onClose={jest.fn()} focusKey="list">
        <Text>Lista</Text>
      </Sheet>,
    );
    expect(spy.mock.calls).toHaveLength(0);

    await view.rerender(
      <Sheet isOpen title="¿Qué versión de Lámina?" onClose={jest.fn()} focusKey="versions">
        <Text>Versiones</Text>
      </Sheet>,
    );

    expect(spy.mock.calls).toHaveLength(1);
    expect(spy.mock.calls[0]?.[1]).toBe('focus');
  });
});
