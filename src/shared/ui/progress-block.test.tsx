import { screen } from '@testing-library/react-native';
import { useReducedMotion, withRepeat } from 'react-native-reanimated';

import { ProgressBlock } from './progress-block';
import { renderUi } from './testing/render-ui';

jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual<object>('react-native-reanimated'),
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
  withRepeat: jest.fn((animation: unknown) => animation),
}));

describe('ProgressBlock', () => {
  it('shows its label and exposes a progress bar named by it', async () => {
    await renderUi(<ProgressBlock label="Leyendo tus datos…" />);

    expect(screen.getByText('Leyendo tus datos…')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Leyendo tus datos…' })).toBeOnTheScreen();
  });

  it('reports the done and total counts as the accessible value', async () => {
    await renderUi(<ProgressBlock label="Copiar las fotos" progress={{ done: 12, total: 40 }} />);

    const bar = screen.getByRole('progressbar', { name: 'Copiar las fotos' });
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 40, now: 12, text: '12 de 40' });
    expect(bar).not.toBeBusy();
  });

  it('uses the given value text', async () => {
    await renderUi(
      <ProgressBlock
        label="Copiar las fotos"
        progress={{ done: 12, total: 40 }}
        valueText="12 de 40 fotos"
      />,
    );

    expect(screen.getByRole('progressbar')).toHaveAccessibilityValue({ text: '12 de 40 fotos' });
  });

  it('fills the bar in proportion to the progress', async () => {
    await renderUi(<ProgressBlock label="Creando" progress={{ done: 1, total: 4 }} />);

    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '25%' });
  });

  it('keeps the bar empty when the total is zero', async () => {
    await renderUi(<ProgressBlock label="Creando" progress={{ done: 0, total: 0 }} />);

    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '0%' });
  });

  it('never fills more than the whole bar', async () => {
    await renderUi(<ProgressBlock label="Creando" progress={{ done: 9, total: 4 }} />);

    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '100%' });
  });

  it('is busy and has no fill without progress', async () => {
    await renderUi(<ProgressBlock label="Revisando el archivo…" />);

    expect(screen.getByRole('progressbar')).toBeBusy();
    expect(screen.queryByTestId('progress-fill')).not.toBeOnTheScreen();
    expect(screen.getByTestId('progress-indeterminate')).toBeOnTheScreen();
  });

  it('moves the indeterminate bar when movement is allowed', async () => {
    await renderUi(<ProgressBlock label="Revisando el archivo…" />);

    expect(withRepeat).toHaveBeenCalled();
  });

  it('leaves the indeterminate bar still when the system asks to reduce motion', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);

    await renderUi(<ProgressBlock label="Revisando el archivo…" />);

    expect(withRepeat).not.toHaveBeenCalled();
    expect(screen.getByTestId('progress-indeterminate')).toBeOnTheScreen();
  });
});
