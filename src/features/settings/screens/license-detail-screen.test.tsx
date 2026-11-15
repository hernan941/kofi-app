import { screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { THIRD_PARTY_NOTICES, type ThirdPartyNotice } from '../domain';
import { LicenseDetailScreen } from './license-detail-screen';

const user = userEvent.setup();

function noticeOf(displayName: string): ThirdPartyNotice {
  const notice = THIRD_PARTY_NOTICES.find((candidate) => candidate.displayName === displayName);
  if (notice === undefined) {
    throw new Error(`There is no notice for ${displayName}.`);
  }
  return notice;
}

async function renderNotice(notice: ThirdPartyNotice, onBack = jest.fn()) {
  await renderUi(<LicenseDetailScreen notice={notice} onBack={onBack} />);
}

describe('LicenseDetailScreen', () => {
  it('shows HeroUI Native with its data and the Apache text, without part headings', async () => {
    const notice = noticeOf('HeroUI Native');
    await renderNotice(notice);

    expect(screen.getByRole('header', { name: 'HeroUI Native' })).toBeOnTheScreen();
    expect(screen.getByLabelText(new RegExp(`^Versión ${notice.version}`))).toBeOnTheScreen();
    expect(screen.getByText('Paquete: heroui-native')).toBeOnTheScreen();
    expect(screen.getByText('Licencia: Apache 2.0')).toBeOnTheScreen();
    expect(screen.getAllByRole('header')).toHaveLength(1);
    expect(screen.getAllByText(/Apache License/).length).toBeGreaterThan(0);
  });

  it('shows Lexend with the code part before the font part', async () => {
    await renderNotice(noticeOf('Lexend'));

    const headings = screen.getAllByRole('header').map((header) => header.props.children as string);

    expect(headings).toEqual([
      'Lexend',
      'Licencia del código: MIT',
      'Licencia de la fuente: SIL Open Font License 1.1',
    ]);
    expect(screen.getAllByText(/SIL Open Font License/).length).toBeGreaterThan(0);
  });

  it('does not repeat the package when it is named as it is shown', async () => {
    await renderNotice(noticeOf('react'));

    expect(screen.queryByText(/^Paquete:/)).not.toBeOnTheScreen();
  });

  it('makes every paragraph selectable', async () => {
    await renderNotice(noticeOf('Phosphor Icons'));

    const paragraph = screen.getByText(/Dustin Do/);

    expect(paragraph).toHaveProp('selectable', true);
  });

  it('goes back', async () => {
    const onBack = jest.fn();
    await renderNotice(noticeOf('react'), onBack);

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
