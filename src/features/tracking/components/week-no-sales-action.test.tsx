import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { seedNoSalesWeek, seedSale, seedSellableProduct } from '@/core/testing/sales-test-data';

import { WeekNoSalesAction } from './week-no-sales-action';

const user = userEvent.setup();

function render(dependencies = createTestDependencies()) {
  return renderWithProviders(<WeekNoSalesAction />, { dependencies, observeDataChanges: true });
}

describe('WeekNoSalesAction', () => {
  it('shows the short visible texts and keeps the long names for the screen reader', async () => {
    await render();

    expect((await screen.findAllByText('Marcar que no vendí')).length).toBe(2);
  });

  it('runs a single mutation when the button is pressed twice in a row', async () => {
    const dependencies = createTestDependencies();
    const markSync = jest.spyOn(dependencies.noSalesWeeks, 'markSync');
    await render(dependencies);
    const button = await screen.findByRole('button', { name: 'Marcar que no vendí esta semana' });

    await user.press(button);
    await user.press(button);

    await screen.findByRole('button', { name: 'Desmarcar esta semana' });
    expect(markSync).toHaveBeenCalledTimes(1);
  });

  it('shows the button busy while the mutation is pending', async () => {
    const base = createTestDependencies();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const dependencies = {
      ...base,
      transactions: { run: async (work) => (await gate, base.transactions.run(work)) },
    } satisfies typeof base;
    await render(dependencies);

    await user.press(
      await screen.findByRole('button', { name: 'Marcar que no vendí esta semana' }),
    );

    expect(screen.getByRole('button', { name: 'Marcar que no vendí esta semana' })).toBeDisabled();
    release();
    expect(await screen.findByRole('button', { name: 'Desmarcar esta semana' })).toBeEnabled();
  });

  it('offers to mark this week and the previous one', async () => {
    await render();

    expect(await screen.findByText('¿Una semana sin ventas?')).toBeOnTheScreen();
    expect(screen.getByText('Anotarla también cuenta para tu racha.')).toBeOnTheScreen();
    expect(await screen.findByText('del 29 de junio al 5 de julio')).toBeOnTheScreen();
    expect(screen.getByText('del 22 al 28 de junio')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Marcar que no vendí esta semana' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Marcar que no vendí la semana pasada' }),
    ).toBeOnTheScreen();
  });

  it('marks the week, says so and offers to undo it', async () => {
    await render();

    await user.press(
      await screen.findByRole('button', { name: 'Marcar que no vendí esta semana' }),
    );

    expect(
      (
        await screen.findAllByText('Listo, anotamos que esta semana no vendiste.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: 'Desmarcar esta semana' })).toBeOnTheScreen();
    expect(screen.getByText('Marcada como "no vendí"')).toBeOnTheScreen();
  });

  it('unmarks a marked previous week', async () => {
    const dependencies = createTestDependencies();
    seedNoSalesWeek(dependencies, '2026-06-22');
    await render(dependencies);

    await user.press(await screen.findByRole('button', { name: 'Desmarcar la semana pasada' }));

    expect(
      (
        await screen.findAllByText('Quitamos la marca de la semana pasada.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Marcar que no vendí la semana pasada' }),
      ).toBeOnTheScreen();
    });
  });

  it('explains that a week with sales does not need the mark', async () => {
    const dependencies = createTestDependencies();
    seedSale(dependencies, { product: seedSellableProduct(dependencies), soldOn: '2026-07-01' });
    await render(dependencies);

    expect(
      await screen.findByText(
        'Esta semana ya tiene ventas, así que no hace falta marcar "no vendí".',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Marcar que no vendí esta semana' }),
    ).not.toBeOnTheScreen();
  });
});
