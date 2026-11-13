import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { saleRecordIdSchema } from '@/shared/domain';

import {
  clp,
  date,
  fixtureId,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
} from '../domain/testing/sale-fixtures';
import { EditSaleScreen } from './edit-sale-screen';
import { SaleDetailScreen } from './sale-detail-screen';

jest.mock('expo-router', () => ({ usePreventRemove: jest.fn() }));

const user = userEvent.setup();

const RECORD_ID = saleRecordIdSchema.parse(fixtureId(4, 1));
const lamina = makeProduct(1, [makeVersion(1, { pricing: { mode: 'fixed', price: clp(15000) } })], {
  name: 'Lámina Colibrí',
});

function seed() {
  const dependencies = createTestDependencies();
  dependencies.products.saveSync(lamina);
  dependencies.sales.saveSync(
    makeSaleRecord([makeSaleItem(1, { quantity: 2, unitPrice: clp(15000) })], {
      id: RECORD_ID,
      soldOn: date('2026-06-30'),
      channel: 'fair',
      note: 'Parque',
    }),
  );
  return dependencies;
}

function renderDetail(dependencies = seed(), id = RECORD_ID) {
  const handlers = { onBack: jest.fn(), onEdit: jest.fn(), onDeleted: jest.fn() };
  const view = renderWithProviders(<SaleDetailScreen saleRecordId={id} {...handlers} />, {
    dependencies,
    observeDataChanges: true,
  });
  return { dependencies, handlers, view };
}

function renderEdit(dependencies = seed(), id = RECORD_ID) {
  const handlers = { onSaved: jest.fn(), onDeleted: jest.fn(), onCancel: jest.fn() };
  const view = renderWithProviders(<EditSaleScreen saleRecordId={id} {...handlers} />, {
    dependencies,
    observeDataChanges: true,
  });
  return { dependencies, handlers, view };
}

describe('SaleDetailScreen', () => {
  it('shows the date as the title, the total and what was sold', async () => {
    const { view } = renderDetail();
    await view;

    expect(
      await screen.findByRole('header', { name: 'Ayer, martes 30 de junio' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Lámina Colibrí, 2 de 15.000 pesos, 30.000 pesos'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Parque')).toBeOnTheScreen();
  });

  it('goes to edit', async () => {
    const { handlers, view } = renderDetail();
    await view;

    await user.press(await screen.findByRole('button', { name: 'Editar venta' }));

    expect(handlers.onEdit).toHaveBeenCalledWith(RECORD_ID);
  });

  it('asks before deleting, with the date and the total, and cancelling changes nothing', async () => {
    const { dependencies, handlers, view } = renderDetail();
    await view;

    await user.press(await screen.findByRole('button', { name: 'Borrar venta' }));
    expect(
      screen.getByText(
        'Se borra la venta del martes 30 de junio por $30.000. No se puede deshacer.',
      ),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await dependencies.sales.findById(RECORD_ID)).not.toBeNull();
    expect(handlers.onDeleted).not.toHaveBeenCalled();
  });

  it('deletes after confirming, tells it and leaves', async () => {
    const { dependencies, handlers, view } = renderDetail();
    await view;

    await user.press(await screen.findByRole('button', { name: 'Borrar venta' }));
    await user.press(screen.getAllByRole('button', { name: 'Borrar venta' }).at(-1) as never);

    await waitFor(() => {
      expect(handlers.onDeleted).toHaveBeenCalledTimes(1);
    });
    expect((await screen.findAllByText('Venta borrada')).length).toBeGreaterThan(0);
    expect(await dependencies.sales.findById(RECORD_ID)).toBeNull();
  });

  it('keeps the screen and says so when deleting fails unexpectedly', async () => {
    const dependencies = seed();
    jest.spyOn(dependencies.saleWriter, 'softDeleteSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    const { handlers, view } = renderDetail(dependencies);
    await view;

    await user.press(await screen.findByRole('button', { name: 'Borrar venta' }));
    await user.press(screen.getAllByRole('button', { name: 'Borrar venta' }).at(-1) as never);

    expect(
      (await screen.findAllByText('No se pudo borrar la venta. Inténtalo de nuevo.')).length,
    ).toBeGreaterThan(0);
    expect(handlers.onDeleted).not.toHaveBeenCalled();
  });

  it('shows the not-found state for a valid id that does not exist', async () => {
    const { handlers, view } = renderDetail(
      createTestDependencies(),
      saleRecordIdSchema.parse(fixtureId(4, 9)),
    );
    await view;

    expect(await screen.findByText('No encontramos esta venta')).toBeOnTheScreen();
    await user.press(screen.getAllByRole('button', { name: 'Volver' }).at(-1) as never);
    expect(handlers.onBack).toHaveBeenCalled();
  });
});

describe('EditSaleScreen', () => {
  it('starts with the values of the sale and the details open', async () => {
    const { view } = renderEdit();
    await view;

    expect(await screen.findByRole('header', { name: 'Editar venta' })).toBeOnTheScreen();
    expect(await screen.findByLabelText('Nota (opcional)')).toHaveDisplayValue('Parque');
    expect(screen.getByRole('button', { name: 'Feria' })).toBeSelected();
    expect(
      screen.getByRole('adjustable', { name: 'Cantidad de Lámina Colibrí' }),
    ).toHaveDisplayValue('2');
  });

  it('saves the change without celebrating, tells it and leaves', async () => {
    const { dependencies, handlers, view } = renderEdit();
    await view;

    await user.press(await screen.findByRole('button', { name: 'Agregar uno' }));
    await user.press(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(handlers.onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'updated', recordId: RECORD_ID }),
      );
    });
    expect((await screen.findAllByText('Cambios guardados')).length).toBeGreaterThan(0);
    expect(screen.queryByText('¡Venta registrada!')).not.toBeOnTheScreen();
    expect((await dependencies.sales.findById(RECORD_ID))?.items[0]?.quantity).toBe(3);
  });

  it('deletes the sale when the last product is removed and confirmed', async () => {
    const { dependencies, handlers, view } = renderEdit();
    await view;

    await user.press(await screen.findByRole('button', { name: 'Quitar' }));
    await user.press(screen.getAllByRole('button', { name: 'Borrar venta' }).at(-1) as never);

    await waitFor(() => {
      expect(handlers.onDeleted).toHaveBeenCalledTimes(1);
    });
    expect(await dependencies.sales.findById(RECORD_ID)).toBeNull();
  });

  it('keeps the edit of an archived product and says it is archived', async () => {
    const dependencies = seed();
    dependencies.products.saveSync({ ...lamina, archivedAt: dependencies.clock.now() });
    const { view } = renderEdit(dependencies);
    await view;

    expect(await screen.findByText('Archivado')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Cambiar' })).not.toBeOnTheScreen();
  });

  it('shows the not-found state for a valid id that does not exist', async () => {
    const { view } = renderEdit(
      createTestDependencies(),
      saleRecordIdSchema.parse(fixtureId(4, 9)),
    );
    await view;

    expect(await screen.findByText('No encontramos esta venta')).toBeOnTheScreen();
  });
});
