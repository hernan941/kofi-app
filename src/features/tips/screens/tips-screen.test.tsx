import { screen } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { TipsScreen } from './tips-screen';

describe('TipsScreen', () => {
  it('shows its title', async () => {
    await renderUi(<TipsScreen />);

    expect(screen.getByRole('header', { name: 'Consejos' })).toBeOnTheScreen();
  });
});
