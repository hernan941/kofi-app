import { screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from './card';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

describe('Card', () => {
  it('shows its title as a heading and its content', async () => {
    await renderUi(
      <Card title="Esta semana">
        <Text>3 ventas</Text>
      </Card>,
    );

    expect(screen.getByRole('header', { name: 'Esta semana' })).toBeOnTheScreen();
    expect(screen.getByText('3 ventas')).toBeOnTheScreen();
  });

  it('is a single button with a summary label when it can be pressed', async () => {
    const onPress = jest.fn();
    await renderUi(
      <Card title="Racha" onPress={onPress} accessibilityLabel="Racha de 4 semanas">
        <Text>4 semanas</Text>
      </Card>,
    );

    await user.press(screen.getByRole('button', { name: 'Racha de 4 semanas' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
