import { screen, userEvent } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { seedSale, seedSellableProduct } from '@/core/testing/sales-test-data';
import { yearMonthSchema } from '@/shared/domain';

import { MonthlySummaryScreen } from './monthly-summary-screen';

const user = userEvent.setup();
const month = (text: string) => yearMonthSchema.parse(text);

function seeded() {
  const dependencies = createTestDependencies();
  const product = seedSellableProduct(dependencies, { name: 'Lámina Colibrí', price: 15000 });
  seedSale(dependencies, { product, soldOn: '2026-07-01', n: 1, quantity: 2 });
  seedSale(dependencies, { product, soldOn: '2026-05-20', n: 2 });
  return dependencies;
}

function props(overrides: Partial<React.ComponentProps<typeof MonthlySummaryScreen>> = {}) {
  return { requestedMonth: null, onChangeMonth: jest.fn(), onBack: jest.fn(), ...overrides };
}

describe('MonthlySummaryScreen', () => {
  it('shows the current month when none is requested', async () => {
    await renderWithProviders(<MonthlySummaryScreen {...props()} />, { dependencies: seeded() });

    expect(await screen.findByRole('header', { name: 'Resumen del mes' })).toBeOnTheScreen();
    expect(await screen.findByRole('header', { name: 'Julio' })).toBeOnTheScreen();
    expect(await screen.findByText('Vendiste')).toBeOnTheScreen();
    expect(screen.getByText('1 venta registrada')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('30.000 pesos')).toHaveLength(2);
    expect(screen.getByRole('header', { name: 'Lo que más vendiste' })).toBeOnTheScreen();
  });

  it('shows the current month for a future month', async () => {
    await renderWithProviders(
      <MonthlySummaryScreen {...props({ requestedMonth: month('2027-01') })} />,
      {
        dependencies: seeded(),
      },
    );

    expect(await screen.findByRole('header', { name: 'Julio' })).toBeOnTheScreen();
  });

  it('shows the loading state first', async () => {
    await renderWithProviders(<MonthlySummaryScreen {...props()} />, { dependencies: seeded() });

    expect(screen.getByLabelText('Cargando el resumen')).toBeOnTheScreen();
    await screen.findByText('Vendiste');
  });

  it('limits the navigation to the first month with sales and to the current month', async () => {
    await renderWithProviders(
      <MonthlySummaryScreen {...props({ requestedMonth: month('2026-05') })} />,
      { dependencies: seeded() },
    );

    expect(await screen.findByRole('button', { name: 'Mes siguiente, junio' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();
  });

  it('asks to change the month through the callback', async () => {
    const onChangeMonth = jest.fn();
    await renderWithProviders(<MonthlySummaryScreen {...props({ onChangeMonth })} />, {
      dependencies: seeded(),
    });

    await user.press(await screen.findByRole('button', { name: 'Mes anterior, junio' }));

    expect(onChangeMonth).toHaveBeenCalledWith('2026-06');
  });

  it('shows a friendly empty month between sales with the navigation active', async () => {
    await renderWithProviders(
      <MonthlySummaryScreen {...props({ requestedMonth: month('2026-06') })} />,
      { dependencies: seeded() },
    );

    expect(await screen.findByText('Junio no tiene ventas anotadas')).toBeOnTheScreen();
    expect(
      screen.getByText('Si vendiste algo en junio, puedes registrarlo eligiendo esa fecha.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mes anterior, mayo' })).not.toBeDisabled();
  });

  it('disables both buttons when there is no sale at all', async () => {
    await renderWithProviders(<MonthlySummaryScreen {...props()} />);

    expect(await screen.findByText('Julio no tiene ventas anotadas')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
  });

  it('goes back', async () => {
    const onBack = jest.fn();
    await renderWithProviders(<MonthlySummaryScreen {...props({ onBack })} />, {
      dependencies: seeded(),
    });

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows an error with a retry and keeps the switcher', async () => {
    const dependencies = seeded();
    jest.spyOn(dependencies.sales, 'listBetween').mockRejectedValueOnce(new Error('boom'));
    await renderWithProviders(<MonthlySummaryScreen {...props()} />, { dependencies });

    expect(
      await screen.findByText('No se pudo cargar el resumen. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Julio' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Vendiste')).toBeOnTheScreen();
  });
});
