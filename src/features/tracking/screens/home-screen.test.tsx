import { act, screen, userEvent, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { seedNoSalesWeek, seedSale, seedSellableProduct } from '@/core/testing/sales-test-data';
import { clp, fixtureId, makeProduct, makeVersion } from '@/features/sales/testing/sale-fixtures';
import { epochMsSchema, saleRecordIdSchema } from '@/shared/domain';
import { advanceClockAndTimers } from '@/shared/domain/testing/advance-clock-and-timers';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import { HomeScreen } from './home-screen';

const user = userEvent.setup();

function props() {
  return { onRegisterSale: jest.fn(), onOpenSale: jest.fn(), onOpenMonthlySummary: jest.fn() };
}

function withSales() {
  const dependencies = createTestDependencies();
  const product = seedSellableProduct(dependencies, { name: 'Lámina Colibrí', price: 15000 });
  seedSale(dependencies, { product, soldOn: '2026-07-01', n: 1, quantity: 2 });
  seedSale(dependencies, { product, soldOn: '2026-06-20', n: 2 });
  return { dependencies, product };
}

describe('HomeScreen first use', () => {
  it('invites to register the first sale with the single main action', async () => {
    const handlers = props();
    await renderWithProviders(<HomeScreen {...handlers} />);

    expect(
      await screen.findByRole('header', { name: 'Aquí vas a ver cuánto vendes' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Registra tu primera venta y verás el total de la semana y del mes. Toma unos segundos.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Registrar venta' })).toHaveLength(1);
    await user.press(screen.getByRole('button', { name: 'Registrar venta' }));

    expect(handlers.onRegisterSale).toHaveBeenCalledTimes(1);
  });

  it('words the empty state without blame', async () => {
    await renderWithProviders(<HomeScreen {...props()} />);

    const title = await screen.findByText('Aquí vas a ver cuánto vendes');

    expect(findGuiltPattern(String(title.props.children))).toBeNull();
  });

  it('shows the loading state instead of the empty state while loading', async () => {
    await renderWithProviders(<HomeScreen {...props()} />);

    expect(screen.getByLabelText('Cargando tus ventas')).toBeOnTheScreen();
    expect(screen.queryByText('Aquí vas a ver cuánto vendes')).not.toBeOnTheScreen();
    await screen.findByText('Aquí vas a ver cuánto vendes');
  });

  it('shows the streak under the empty state when a week was marked as no sales', async () => {
    const dependencies = createTestDependencies();
    seedNoSalesWeek(dependencies, '2026-06-29');

    await renderWithProviders(<HomeScreen {...props()} />, { dependencies });

    expect(await screen.findByText('1 semana registrando')).toBeOnTheScreen();
    expect(screen.getByText('Aquí vas a ver cuánto vendes')).toBeOnTheScreen();
  });
});

describe('HomeScreen with sales', () => {
  it('shows the amounts of the week and of the month through Amount', async () => {
    const { dependencies } = withSales();
    await renderWithProviders(<HomeScreen {...props()} />, { dependencies });

    expect(await screen.findByRole('header', { name: 'Inicio' })).toBeOnTheScreen();
    expect(await screen.findByText('Esta semana')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('30.000 pesos')[0]).toHaveProp(
      'className',
      expect.stringContaining('text-display'),
    );
    expect(screen.getByText('En julio')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Esta semana vendiste 30.000 pesos. 30.000 pesos más que a esta altura de la semana pasada.',
      ),
    ).toBeOnTheScreen();
  });

  it('does not show the profit without costs nor tips', async () => {
    const { dependencies } = withSales();
    await renderWithProviders(<HomeScreen {...props()} />, { dependencies });

    await screen.findByText('Esta semana');

    expect(screen.queryByText(/te quedaron aprox\./)).not.toBeOnTheScreen();
    expect(screen.queryByText(/consejo/i)).not.toBeOnTheScreen();
  });

  it('shows the profit of the month when the product has a cost', async () => {
    const dependencies = createTestDependencies();
    dependencies.products.saveSync(
      makeProduct(
        1,
        [makeVersion(1, { cost: clp(5000), pricing: { mode: 'fixed', price: clp(15000) } })],
        {
          name: 'Lámina Colibrí',
        },
      ),
    );
    seedSale(dependencies, {
      product: makeProduct(1, [
        makeVersion(1, { cost: null, pricing: { mode: 'fixed', price: clp(15000) } }),
      ]),
      soldOn: '2026-07-01',
    });

    await renderWithProviders(<HomeScreen {...props()} />, { dependencies });

    expect(await screen.findByText('Este mes te quedaron aprox. $10.000.')).toBeOnTheScreen();
  });

  it('lists the latest sales and opens the one that is pressed', async () => {
    const { dependencies } = withSales();
    const handlers = props();
    await renderWithProviders(<HomeScreen {...handlers} />, { dependencies });

    await user.press(
      await screen.findByRole('button', {
        name: 'Lámina Colibrí, hoy, miércoles 1 de julio, 30.000 pesos',
      }),
    );

    expect(handlers.onOpenSale).toHaveBeenCalledWith(saleRecordIdSchema.parse(fixtureId(4, 1)));
  });

  it('keeps "Registrar venta" as the fixed main action', async () => {
    const { dependencies } = withSales();
    const handlers = props();
    await renderWithProviders(<HomeScreen {...handlers} />, { dependencies });

    await user.press(await screen.findByRole('button', { name: 'Registrar venta' }));

    expect(handlers.onRegisterSale).toHaveBeenCalledTimes(1);
  });

  it('opens the monthly summary', async () => {
    const { dependencies } = withSales();
    const handlers = props();
    await renderWithProviders(<HomeScreen {...handlers} />, { dependencies });

    await user.press(await screen.findByRole('button', { name: 'Ver resumen de julio' }));

    expect(handlers.onOpenMonthlySummary).toHaveBeenCalledTimes(1);
  });

  it('shows the streak only from one week', async () => {
    const { dependencies } = withSales();
    await renderWithProviders(<HomeScreen {...props()} />, { dependencies });

    expect(await screen.findByText('1 semana registrando')).toBeOnTheScreen();
  });

  it('does not show the streak at zero weeks', async () => {
    const dependencies = createTestDependencies();
    const product = seedSellableProduct(dependencies);
    seedSale(dependencies, { product, soldOn: '2026-06-10' });
    await renderWithProviders(<HomeScreen {...props()} />, { dependencies });

    await screen.findByText('Esta semana');

    expect(screen.queryByText(/registrando/)).not.toBeOnTheScreen();
  });

  it('shows the quiet text on Monday when the previous Monday had sales', async () => {
    jest.useFakeTimers();
    try {
      const { dependencies } = withSales();
      const product = seedSellableProduct(dependencies, { n: 2, name: 'Taza' });
      seedSale(dependencies, { product, soldOn: '2026-06-29', n: 5 });
      dependencies.clock.set(epochMsSchema.parse(Date.parse('2026-07-05T23:59:00-04:00')));
      await renderWithProviders(<HomeScreen {...props()} />, { dependencies });
      await screen.findByText('Esta semana');

      await act(() => {
        advanceClockAndTimers(dependencies.clock, 2 * 60 * 1000);
      });

      await waitFor(() => {
        expect(screen.getAllByLabelText('0 pesos').length).toBeGreaterThan(0);
      });
      expect(screen.getByText(/^Semana tranquila por ahora\./)).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('HomeScreen errors', () => {
  it('shows an error with a retry and keeps the main action when the summary fails', async () => {
    const { dependencies } = withSales();
    const listBetween = jest
      .spyOn(dependencies.sales, 'listBetween')
      .mockRejectedValueOnce(new Error('boom'));
    await renderWithProviders(<HomeScreen {...props()} />, { dependencies });

    expect(
      await screen.findByText('No se pudieron cargar tus ventas. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Registrar venta' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Esta semana')).toBeOnTheScreen();
    expect(listBetween).toHaveBeenCalledTimes(2);
  });

  it('shows the summary and a notice inside the latest sales when only they fail', async () => {
    const { dependencies } = withSales();
    jest.spyOn(dependencies.sales, 'listRecent').mockRejectedValueOnce(new Error('boom'));
    await renderWithProviders(<HomeScreen {...props()} />, { dependencies });

    expect(await screen.findByText('Esta semana')).toBeOnTheScreen();
    expect(await screen.findByText('No se pudieron cargar tus últimas ventas.')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('button', { name: /^Lámina Colibrí, hoy,/ })).toBeOnTheScreen();
  });
});
