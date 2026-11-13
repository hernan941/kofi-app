import { screen } from '@testing-library/react-native';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';

import { Icon } from './icon';
import { renderUi } from './testing/render-ui';

describe('Icon', () => {
  it('renders the Phosphor glyph in bold by default and hides it from the screen reader', async () => {
    await renderUi(<Icon icon={CheckIcon} />);

    expect(screen.queryByTestId('phosphor-react-native-check-bold')).not.toBeOnTheScreen();
    expect(
      screen.getByTestId('phosphor-react-native-check-bold', { includeHiddenElements: true }),
    ).toHaveProp('width', 24);
  });

  it('uses the size scale of the design system', async () => {
    await renderUi(<Icon icon={CheckIcon} size="sm" weight="fill" />);

    expect(
      screen.getByTestId('phosphor-react-native-check-fill', { includeHiddenElements: true }),
    ).toHaveProp('width', 16);
  });
});
