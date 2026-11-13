import { screen } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { SettingsScreen } from './settings-screen';

describe('SettingsScreen', () => {
  it('shows its title', async () => {
    await renderUi(<SettingsScreen />);

    expect(screen.getByRole('header', { name: 'Ajustes' })).toBeOnTheScreen();
  });
});
