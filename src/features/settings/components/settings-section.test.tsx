import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { SettingsSection } from './settings-section';

describe('SettingsSection', () => {
  it('shows its heading as a header and its content', async () => {
    await renderUi(
      <SettingsSection heading="Acerca de">
        <Text>Contenido</Text>
      </SettingsSection>,
    );

    expect(screen.getByRole('header', { name: 'Acerca de' })).toBeOnTheScreen();
    expect(screen.getByText('Contenido')).toBeOnTheScreen();
  });
});
