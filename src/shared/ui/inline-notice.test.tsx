import { screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { ArchiveIcon, CheckCircleIcon } from './icons';
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

  it('keeps the quiet info look and does not announce by default', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    await renderUi(<InlineNotice message="Está archivado." />);

    expect(
      screen.getByTestId('phosphor-react-native-info-bold', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(spy).not.toHaveBeenCalled();
  });

  it('draws the filled check and announces once with the success tone', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    const { rerender } = await renderUi(<InlineNotice tone="success" message="Copia lista." />);
    await rerender(<InlineNotice tone="success" message="Copia lista." />);

    expect(
      screen.getByTestId('phosphor-react-native-check-circle-fill', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Copia lista.');
  });

  it('draws the warning icon and announces with the danger tone', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    await renderUi(<InlineNotice tone="danger" message="No se pudo crear la copia." />);

    expect(
      screen.getByTestId('phosphor-react-native-warning-circle-bold', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(spy).toHaveBeenCalledWith('No se pudo crear la copia.');
  });

  it('lets an explicit icon replace the one of the info tone', async () => {
    await renderUi(<InlineNotice message="Activados." icon={CheckCircleIcon} />);

    expect(
      screen.getByTestId('phosphor-react-native-check-circle-bold', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
  });
});
