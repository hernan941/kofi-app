import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { FadeIn } from './fade-in';
import { renderUi } from './testing/render-ui';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated'),
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
}));

const mockedReducedMotion = jest.mocked(useReducedMotion);

describe('FadeIn', () => {
  it('shows its children from the start for the screen reader', async () => {
    await renderUi(
      <FadeIn>
        <Text>Contenido</Text>
      </FadeIn>,
    );

    expect(screen.getByText('Contenido')).toBeOnTheScreen();
  });

  it('animates the entrance and the exit when movement is allowed', async () => {
    await renderUi(
      <FadeIn testID="fade">
        <Text>Contenido</Text>
      </FadeIn>,
    );

    expect(screen.getByTestId('fade').props).toEqual(
      expect.objectContaining({
        entering: expect.anything() as unknown,
        exiting: expect.anything() as unknown,
      }),
    );
  });

  it('does not animate when the system asks to reduce motion', async () => {
    mockedReducedMotion.mockReturnValue(true);

    await renderUi(
      <FadeIn testID="fade">
        <Text>Contenido</Text>
      </FadeIn>,
    );

    expect(screen.getByText('Contenido')).toBeOnTheScreen();
    expect(screen.getByTestId('fade').props).not.toHaveProperty('entering');
    expect(screen.getByTestId('fade').props).not.toHaveProperty('exiting');
  });
});
