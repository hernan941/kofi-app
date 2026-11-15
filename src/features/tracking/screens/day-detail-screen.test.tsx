import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/core/testing/render-with-providers';
import { localDateSchema } from '@/shared/domain';

import { DayDetailScreen } from './day-detail-screen';

describe('DayDetailScreen', () => {
  it('titles the screen with the date and goes back', async () => {
    const onBack = jest.fn();
    await renderWithProviders(
      <DayDetailScreen
        date={localDateSchema.parse('2026-06-30')}
        onBack={onBack}
        onOpenSale={jest.fn()}
        onRegisterSale={jest.fn()}
      />,
    );

    expect(screen.getByRole('header', { name: 'Ayer, martes 30 de junio' })).toBeOnTheScreen();
    expect(await screen.findByText('Sin ventas anotadas este día')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeOnTheScreen();
  });
});
