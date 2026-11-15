import { screen } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { LicenseText } from './license-text';

const TEXT = 'First paragraph\nstill the first.\n\nSecond paragraph.';

describe('LicenseText', () => {
  it('shows one selectable text per paragraph', async () => {
    await renderUi(<LicenseText spdxId="MIT" part={null} text={TEXT} showHeading={false} />);

    const first = screen.getByText('First paragraph still the first.');
    const second = screen.getByText('Second paragraph.');
    expect(first).toHaveProp('selectable', true);
    expect(second).toHaveProp('selectable', true);
  });

  it('has no heading when the notice has a single license', async () => {
    await renderUi(<LicenseText spdxId="MIT" part={null} text={TEXT} showHeading={false} />);

    expect(screen.queryByRole('header')).not.toBeOnTheScreen();
  });

  it('titles the code part with its license', async () => {
    await renderUi(<LicenseText spdxId="MIT" part="code" text={TEXT} showHeading />);

    expect(screen.getByRole('header', { name: 'Licencia del código: MIT' })).toBeOnTheScreen();
  });

  it('titles the font part with its license', async () => {
    await renderUi(<LicenseText spdxId="OFL-1.1" part="font" text={TEXT} showHeading />);

    expect(
      screen.getByRole('header', { name: 'Licencia de la fuente: SIL Open Font License 1.1' }),
    ).toBeOnTheScreen();
  });
});
