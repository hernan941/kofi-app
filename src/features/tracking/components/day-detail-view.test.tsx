import { screen, userEvent } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { seedSale, seedSellableProduct } from '@/core/testing/sales-test-data';
import { localDateSchema } from '@/shared/domain';

import { DayDetailView } from './day-detail-view';

const user = userEvent.setup();
const date = (text: string) => localDateSchema.parse(text);

function showDay(
  target: string,
  handlers: { onOpenSale: jest.Mock; onRegisterSale: jest.Mock } = {
    onOpenSale: jest.fn(),
    onRegisterSale: jest.fn(),
  },
  dependencies = createTestDependencies(),
) {
  return renderWithProviders(<DayDetailView date={date(target)} {...handlers} />, {
    dependencies,
  });
}

function newHandlers() {
  return { onOpenSale: jest.fn(), onRegisterSale: jest.fn() };
}

function withSales() {
  const dependencies = createTestDependencies();
  const product = seedSellableProduct(dependencies, { name: 'Lámina Colibrí', price: 15000 });
  seedSale(dependencies, { product, soldOn: '2026-06-30', n: 1, quantity: 2 });
  seedSale(dependencies, { product, soldOn: '2026-06-30', n: 2 });
  return dependencies;
}

describe('DayDetailView', () => {
  it('shows the total, the count and the records of a past day', async () => {
    const handlers = newHandlers();
    await showDay('2026-06-30', handlers, withSales());

    expect(await screen.findByText('2 ventas', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('$45.000', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Vendiste: 45.000 pesos, 2 ventas')).toBeOnTheScreen();
    expect(screen.getByText('Ventas de este día')).toBeOnTheScreen();
    expect(screen.getAllByText('Lámina Colibrí', { includeHiddenElements: true })).toHaveLength(2);

    const [firstRow] = screen.getAllByText('Lámina Colibrí', { includeHiddenElements: true });
    if (firstRow === undefined) throw new Error('A row was expected');
    await user.press(firstRow);
    expect(handlers.onOpenSale).toHaveBeenCalledTimes(1);

    await user.press(screen.getByRole('button', { name: 'Registrar una venta este día' }));
    expect(handlers.onRegisterSale).toHaveBeenCalledWith('2026-06-30');
  });

  it('invites to register when today has no sales, with a single button', async () => {
    const handlers = newHandlers();
    await showDay('2026-07-01', handlers);

    expect(await screen.findByText('Hoy sin ventas anotadas')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Registrar una venta este día' })).toHaveLength(1);
    await user.press(screen.getByRole('button', { name: 'Registrar una venta este día' }));
    expect(handlers.onRegisterSale).toHaveBeenCalledWith('2026-07-01');
  });

  it('words an empty past day kindly', async () => {
    await showDay('2026-06-20');

    expect(await screen.findByText('Sin ventas anotadas este día')).toBeOnTheScreen();
    expect(screen.getByText('Si vendiste algo, regístralo con esta fecha.')).toBeOnTheScreen();
  });

  it('does not offer to register a future day', async () => {
    await showDay('2026-07-02');

    expect(
      await screen.findByText('Puedes registrar ventas de hoy o de días anteriores.'),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Registrar una venta este día' }),
    ).not.toBeOnTheScreen();
  });

  it('shows an error with a retry when the day cannot be read', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.sales, 'listBetween').mockRejectedValue(new Error('boom'));
    jest.spyOn(dependencies.logger, 'error').mockImplementation(() => undefined);
    await showDay('2026-06-30', newHandlers(), dependencies);

    expect(
      await screen.findByText('No se pudo cargar este día. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });
});
