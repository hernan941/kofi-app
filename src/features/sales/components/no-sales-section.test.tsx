import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { epochMsSchema } from '@/shared/domain';

import { makeSaleItem, makeSaleRecord } from '../domain/testing/sale-fixtures';
import { NoSalesSection } from './no-sales-section';

const user = userEvent.setup();

async function findVisibleText(text: string) {
  const [visible] = await screen.findAllByText(text, { includeHiddenElements: true });
  return visible;
}

function render(dependencies = createTestDependencies()) {
  return {
    dependencies,
    view: renderWithProviders(<NoSalesSection />, { dependencies, observeDataChanges: true }),
  };
}

describe('NoSalesSection', () => {
  it('shows nothing while the prompt is loading', async () => {
    const { view } = render();
    await view;

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('shows nothing when the prompt cannot be read', async () => {
    const dependencies = createTestDependencies();
    const activeWeeks = jest
      .spyOn(dependencies.sales, 'activeWeekStartsBetween')
      .mockRejectedValue(new Error('boom'));
    const { view } = render(dependencies);
    await view;

    await waitFor(() => {
      expect(activeWeeks).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  it('marks the current week, tells it and switches to the marked state', async () => {
    const { view } = render();
    await view;

    await user.press(await screen.findByRole('button', { name: 'Esta semana no vendí' }));

    expect(await findVisibleText('Listo, anotamos que esta semana no vendiste.')).toBeOnTheScreen();
    expect(await screen.findByText('Marcaste que esta semana no vendiste.')).toBeOnTheScreen();
  });

  it('undoes the mark and tells it', async () => {
    const { view } = render();
    await view;
    await user.press(await screen.findByRole('button', { name: 'Esta semana no vendí' }));
    await user.press(await screen.findByRole('button', { name: 'Desmarcar' }));

    expect(await findVisibleText('Quitamos la marca de esta semana.')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Esta semana no vendí' })).toBeOnTheScreen();
  });

  it('tells the previous week when it is the one marked', async () => {
    const dependencies = createTestDependencies();
    dependencies.clock.set(epochMsSchema.parse(Date.parse('2026-11-09T16:00:00Z')));
    const { view } = render(dependencies);
    await view;

    await user.press(await screen.findByRole('radio', { name: 'La semana pasada' }));
    await user.press(screen.getByRole('button', { name: 'Marcar que no vendí' }));

    expect(
      await findVisibleText('Listo, anotamos que la semana pasada no vendiste.'),
    ).toBeOnTheScreen();
  });

  it('explains kindly when the week already has sales', async () => {
    const dependencies = createTestDependencies();
    dependencies.sales.saveSync(makeSaleRecord([makeSaleItem(1)]));
    const { view } = render(dependencies);
    await view;

    expect(
      await screen.findByText(
        'Esta semana ya tiene ventas, así que no hace falta marcar "no vendí".',
      ),
    ).toBeOnTheScreen();
  });

  it('shows a calm error and keeps the panel when marking fails unexpectedly', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.noSalesWeeks, 'markSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    const { view } = render(dependencies);
    await view;

    await user.press(await screen.findByRole('button', { name: 'Esta semana no vendí' }));

    expect(await findVisibleText('No se pudo marcar. Inténtalo de nuevo.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Esta semana no vendí' })).toBeOnTheScreen();
  });
});
