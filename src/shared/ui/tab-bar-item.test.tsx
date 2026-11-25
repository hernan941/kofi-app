import { renderHook, screen } from '@testing-library/react-native';
import { useThemeColor } from 'heroui-native';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TabBarIcon, TabBarLabel, tabBarHeight, useTabBarStyle } from './tab-bar-item';
import { renderUi, UiTestProviders } from './testing/render-ui';

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

  it('allows the system font size to grow up to 1.3 times', async () => {
    await renderUi(<TabBarLabel label="Inicio" focused={false} />);

    expect(screen.getByText('Inicio')).toHaveProp('maxFontSizeMultiplier', 1.3);
  });

  it('stays on one line instead of being cut in the middle of a word', async () => {
    await renderUi(<TabBarLabel label="Calendario" focused={false} />);

    expect(screen.getByText('Calendario')).toHaveProp('numberOfLines', 1);
  });

  it('shrinks to fit when the text does not fit', async () => {
    await renderUi(<TabBarLabel label="Calendario" focused={false} />);

    expect(screen.getByText('Calendario')).toHaveProp('adjustsFontSizeToFit', true);
  });

  it('takes the whole width of the tab and recovers the button padding', async () => {
    await renderUi(<TabBarLabel label="Calendario" focused={false} />);

    const label = screen.getByText('Calendario');
    expect(label).toHaveProp('className', expect.stringContaining('self-stretch'));
    expect(label).toHaveProp('className', expect.stringContaining('-mx-1'));
  });
});

describe('tabBarHeight', () => {
  beforeEach(() => {
    jest.spyOn(StyleSheet, 'hairlineWidth', 'get').mockReturnValue(0.5);
  });

  it.each([
    [1, 0, 57],
    [0.85, 0, 57],
    [1.3, 0, 62],
    [2, 0, 62],
    [1, 24, 81],
  ])('with font scale %s and inset %s is %s', (fontScale, inset, expected) => {
    expect(tabBarHeight(fontScale, inset)).toBe(expected);
  });
});

const INSET_BOTTOM = 24;

/** Providers of the tests with a bottom inset like the gesture bar of a phone. */
function InsetProviders({ children }: { readonly children: ReactNode }) {
  return (
    <UiTestProviders>
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 392, height: 800 },
          insets: { top: 0, right: 0, bottom: INSET_BOTTOM, left: 0 },
        }}
      >
        {children}
      </SafeAreaProvider>
    </UiTestProviders>
  );
}

describe('useTabBarStyle', () => {
  it('uses the system font scale, the bottom inset and the theme colors', async () => {
    jest
      .spyOn(Dimensions, 'get')
      .mockReturnValue({ width: 392, height: 800, scale: 2, fontScale: 1.3 });

    const { result } = await renderHook(
      () => ({ style: useTabBarStyle(), colors: useThemeColor(['surface', 'border']) }),
      { wrapper: InsetProviders },
    );

    expect(result.current.style).toEqual({
      backgroundColor: result.current.colors[0],
      borderTopColor: result.current.colors[1],
      height: tabBarHeight(1.3, INSET_BOTTOM),
    });
  });
});
