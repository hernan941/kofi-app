import { screen, userEvent } from '@testing-library/react-native';

import { NotFoundScreen } from './not-found-screen';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

describe('NotFoundScreen', () => {
  it('explains that the screen does not exist and offers the way back', async () => {
    const onGoHome = jest.fn();
    await renderUi(<NotFoundScreen onGoHome={onGoHome} />);

    expect(screen.getByRole('header', { name: 'No encontramos esa pantalla' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Ir al inicio' }));

    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});
