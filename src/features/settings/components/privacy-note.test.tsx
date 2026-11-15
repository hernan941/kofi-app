import { screen } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { PrivacyNote } from './privacy-note';
import { SETTINGS_TEXTS } from './settings-texts';

describe('PrivacyNote', () => {
  it('shows both paragraphs', async () => {
    await renderUi(<PrivacyNote />);

    expect(screen.getByText(SETTINGS_TEXTS.privacy.first)).toBeOnTheScreen();
    expect(screen.getByText(SETTINGS_TEXTS.privacy.second)).toBeOnTheScreen();
  });

  it('is read as a single element with both paragraphs', async () => {
    await renderUi(<PrivacyNote />);

    expect(
      screen.getByLabelText(`${SETTINGS_TEXTS.privacy.first} ${SETTINGS_TEXTS.privacy.second}`),
    ).toBeOnTheScreen();
  });
});
