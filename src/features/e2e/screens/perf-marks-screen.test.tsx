import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/core/testing/render-with-providers';
import { clearPerfMarks, perfMark } from '@/shared/lib/perf-marks';

import { PerfMarksScreen } from './perf-marks-screen';

describe('PerfMarksScreen', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_E2E = '1';
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E;
    clearPerfMarks();
  });

  it('says there are no marks yet', async () => {
    await renderWithProviders(<PerfMarksScreen />);

    expect(screen.getByRole('header', { name: 'Marcas de rendimiento' })).toBeOnTheScreen();
    expect(screen.getByTestId('perf-marks')).toHaveTextContent('sin marcas');
  });

  it('lists the recorded marks as text that Maestro can copy', async () => {
    perfMark('calendar:month:press', '2026-10');
    perfMark('calendar:month:ready', '2026-10');

    await renderWithProviders(<PerfMarksScreen />);

    const text = String(screen.getByTestId('perf-marks').props.children);
    expect(text).toMatch(
      /^mark calendar:month:press 2026-10 [\d.]+\nmark calendar:month:ready 2026-10 [\d.]+/,
    );
  });
});
