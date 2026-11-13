import { screen } from '@testing-library/react-native';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';

import { TabBarIcon, TabBarLabel } from './tab-bar-item';
import { renderUi } from './testing/render-ui';

const HIDDEN = { includeHiddenElements: true } as const;

describe('TabBarIcon', () => {
  it('uses the fill weight for the active tab', async () => {
    await renderUi(<TabBarIcon icon={HouseIcon} focused />);

    expect(screen.getByTestId('phosphor-react-native-house-fill', HIDDEN)).toBeOnTheScreen();
  });

  it('uses the bold weight for an inactive tab', async () => {
    await renderUi(<TabBarIcon icon={HouseIcon} focused={false} />);

    expect(screen.getByTestId('phosphor-react-native-house-bold', HIDDEN)).toBeOnTheScreen();
  });
});

describe('TabBarLabel', () => {
  it('is semibold and accent when active', async () => {
    await renderUi(<TabBarLabel label="Inicio" focused />);

    const label = screen.getByText('Inicio');
    expect(label).toHaveProp('className', expect.stringContaining('font-semibold'));
    expect(label).toHaveProp('className', expect.stringContaining('text-accent'));
  });

  it('is medium and muted when inactive', async () => {
    await renderUi(<TabBarLabel label="Inicio" focused={false} />);

    const label = screen.getByText('Inicio');
    expect(label).toHaveProp('className', expect.stringContaining('font-medium'));
    expect(label).toHaveProp('className', expect.stringContaining('text-muted'));
  });

  it('allows the system font size to grow up to 1.5 times', async () => {
    await renderUi(<TabBarLabel label="Inicio" focused={false} />);

    expect(screen.getByText('Inicio')).toHaveProp('maxFontSizeMultiplier', 1.5);
  });
});
