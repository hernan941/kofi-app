import { screen } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { CalendarLegend } from './calendar-legend';

describe('CalendarLegend', () => {
  it('explains that three dots are the best day of the month', async () => {
    await renderUi(<CalendarLegend />);

    expect(
      screen.getByLabelText('Un punto es poco y tres puntos es tu mejor día del mes.'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/Poco/)).toBeOnTheScreen();
    expect(screen.getByText(/Mucho/)).toBeOnTheScreen();
  });
});
