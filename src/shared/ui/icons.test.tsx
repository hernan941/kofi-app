import { screen } from '@testing-library/react-native';

import type { Icon as PhosphorIcon } from 'phosphor-react-native';

import { Icon } from './icon';
import * as icons from './icons';
import { renderUi } from './testing/render-ui';

const SALES_ICONS = [
  ['CheckIcon', 'check'],
  ['CheckCircleIcon', 'check-circle'],
  ['ConfettiIcon', 'confetti'],
  ['StorefrontIcon', 'storefront'],
  ['CaretDownIcon', 'caret-down'],
  ['CaretUpIcon', 'caret-up'],
  ['CaretRightIcon', 'caret-right'],
  ['MagnifyingGlassIcon', 'magnifying-glass'],
  ['WarningCircleIcon', 'warning-circle'],
  ['TrashIcon', 'trash'],
  ['FireIcon', 'fire'],
] as const;

describe('icons', () => {
  it.each(SALES_ICONS)('exports %s and draws it through Icon', async (exportName, testIdName) => {
    const registry: Record<string, PhosphorIcon> = icons;
    const glyph = registry[exportName];
    if (glyph === undefined) throw new Error(`Missing export ${exportName}`);

    await renderUi(<Icon icon={glyph} />);

    expect(
      screen.getByTestId(`phosphor-react-native-${testIdName}-bold`, {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
  });
});
