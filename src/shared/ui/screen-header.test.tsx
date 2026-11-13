import { screen, userEvent } from '@testing-library/react-native';

import { ScreenHeader } from './screen-header';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

describe('ScreenHeader', () => {
  it('shows the title as a header and no back button without onBack', async () => {
    await renderUi(<ScreenHeader title="Productos" />);

    expect(screen.getByRole('header', { name: 'Productos' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeOnTheScreen();
  });

  it('offers a "Volver" button that calls onBack', async () => {
    const onBack = jest.fn();
    await renderUi(<ScreenHeader title="Archivados" onBack={onBack} />);

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('can be drawn without a title', async () => {
    await renderUi(<ScreenHeader onBack={jest.fn()} />);

    expect(screen.queryByRole('header')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeOnTheScreen();
  });
});
