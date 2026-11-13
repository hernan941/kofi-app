import { screen } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { CalendarScreen } from './calendar-screen';

describe('CalendarScreen', () => {
  it('shows its title', async () => {
    await renderUi(<CalendarScreen />);

    expect(screen.getByRole('header', { name: 'Calendario' })).toBeOnTheScreen();
  });
});
