import { screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import type { NoticeId, ThirdPartyNotice } from '../domain';
import { LicenseRow } from './license-row';

const user = userEvent.setup();
const NOTICE: ThirdPartyNotice = {
  id: 'heroui-native-1-0-11' as NoticeId,
  packageName: 'heroui-native',
  displayName: 'HeroUI Native',
  version: '1.0.11',
  license: 'Apache-2.0',
  texts: [{ spdxId: 'Apache-2.0', part: null, textKey: 'k' }],
};

describe('LicenseRow', () => {
  it('shows the name, the version and the readable license', async () => {
    await renderUi(<LicenseRow notice={NOTICE} onPress={jest.fn()} />);

    expect(screen.getByText('HeroUI Native', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByText('Versión 1.0.11 · Apache 2.0', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('is a single button with a label and a hint, and opens the notice', async () => {
    const onPress = jest.fn();
    await renderUi(<LicenseRow notice={NOTICE} onPress={onPress} />);

    const button = screen.getByRole('button', {
      name: 'HeroUI Native, versión 1.0.11, Apache 2.0',
    });
    expect(button).toHaveProp('accessibilityHint', 'Abre el texto completo de la licencia');
    await user.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
