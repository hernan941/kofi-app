import { screen } from '@testing-library/react-native';

import { ArchiveIcon } from './icons';
import { InlineNotice } from './inline-notice';
import { renderUi } from './testing/render-ui';

describe('InlineNotice', () => {
  it('reads as a single element with its message', async () => {
    await renderUi(<InlineNotice message="Está archivado." />);

    expect(screen.getByText('Está archivado.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Está archivado.')).toBeOnTheScreen();
  });

  it('hides its icon from the screen reader', async () => {
    await renderUi(<InlineNotice message="Está archivado." icon={ArchiveIcon} />);

    expect(
      screen.getByTestId('phosphor-react-native-archive-bold', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('phosphor-react-native-archive-bold')).not.toBeOnTheScreen();
  });
});
