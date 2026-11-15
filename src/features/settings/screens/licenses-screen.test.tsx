import { screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { LICENSES_TEXTS, licenseRowLabel } from '../components/settings-texts';
import { THIRD_PARTY_NOTICES, sortNotices } from '../domain';
import { LicensesScreen } from './licenses-screen';

const user = userEvent.setup();

function noticeOf(displayName: string) {
  const notice = THIRD_PARTY_NOTICES.find((candidate) => candidate.displayName === displayName);
  if (notice === undefined) {
    throw new Error(`There is no notice for ${displayName}.`);
  }
  return notice;
}

const SAMPLE = ['HeroUI Native', 'Lexend', 'Phosphor Icons'].map(noticeOf);

async function renderScreen(props: Partial<Parameters<typeof LicensesScreen>[0]> = {}) {
  await renderUi(<LicensesScreen onBack={jest.fn()} onOpenNotice={jest.fn()} {...props} />);
}

async function renderSample(props: Partial<Parameters<typeof LicensesScreen>[0]> = {}) {
  await renderScreen({ notices: SAMPLE, ...props });
}

describe('LicensesScreen', () => {
  it('shows its title and the introduction', async () => {
    await renderScreen();

    expect(screen.getByRole('header', { name: 'Licencias de terceros' })).toBeOnTheScreen();
    expect(screen.getByText(LICENSES_TEXTS.introduction)).toBeOnTheScreen();
  });

  it('shows HeroUI Native with its version and license', async () => {
    await renderSample();
    const heroui = noticeOf('HeroUI Native');

    expect(
      screen.getByRole('button', { name: `HeroUI Native, versión ${heroui.version}, Apache 2.0` }),
    ).toHaveProp('accessibilityHint', 'Abre el texto completo de la licencia');
  });

  it('shows Phosphor Icons and Lexend with their readable licenses', async () => {
    await renderSample();

    expect(
      screen.getByRole('button', { name: /^Phosphor Icons, versión .+, MIT$/ }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: /^Lexend, versión .+, MIT y SIL Open Font License 1\.1$/,
      }),
    ).toBeOnTheScreen();
  });

  it('virtualizes the list and starts with the first notice in alphabetical order', async () => {
    await renderScreen();

    const buttons = screen
      .getAllByRole('button')
      .filter((button) => button.props.accessibilityHint === LICENSES_TEXTS.rowHint);
    const [first] = sortNotices(THIRD_PARTY_NOTICES);

    expect(buttons.length).toBeLessThan(THIRD_PARTY_NOTICES.length);
    expect(first).toBeDefined();
    expect(buttons[0]).toHaveProp('accessibilityLabel', first ? licenseRowLabel(first) : '');
  });

  it('opens a notice with its id', async () => {
    const onOpenNotice = jest.fn();
    await renderSample({ onOpenNotice });
    const heroui = noticeOf('HeroUI Native');

    await user.press(screen.getByRole('button', { name: /^HeroUI Native, versión/ }));

    expect(onOpenNotice).toHaveBeenCalledWith(heroui.id);
  });

  it('goes back', async () => {
    const onBack = jest.fn();
    await renderScreen({ onBack });

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
