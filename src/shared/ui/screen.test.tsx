import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Screen } from './screen';
import { renderUi } from './testing/render-ui';

describe('Screen', () => {
  it('renders its content', async () => {
    await renderUi(
      <Screen>
        <Text>Contenido</Text>
      </Screen>,
    );

    expect(screen.getByText('Contenido')).toBeOnTheScreen();
  });
});
