import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/core/testing/render-with-providers';

import { buildSaleRecordView } from '../domain';
import {
  clp,
  date,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
  productId,
  productsById,
  versionId,
} from '../domain/testing/sale-fixtures';
import { SaleDetail } from './sale-detail';

const user = userEvent.setup();
const TODAY = date('2026-11-13');

const lamina = makeProduct(1, [makeVersion(1, { pricing: { mode: 'fixed', price: clp(15000) } })], {
  name: 'Lámina Colibrí',
});
const print = makeProduct(
  2,
  [
    makeVersion(2, { productN: 2, name: 'Print A4' }),
    makeVersion(3, { productN: 2, name: 'Print A3' }),
  ],
  { name: 'Print' },
);

function renderDetail(
  record = makeSaleRecord([makeSaleItem(1, { unitPrice: clp(15000) })]),
  products = productsById(lamina, print),
) {
  const onDelete = jest.fn();
  const view = renderWithProviders(
    <SaleDetail view={buildSaleRecordView(record, products)} today={TODAY} onDelete={onDelete} />,
  );
  return { onDelete, view };
}

describe('SaleDetail', () => {
  it('shows the total big and one static row per item', async () => {
    const { view } = renderDetail(makeSaleRecord([makeSaleItem(1, { unitPrice: clp(15000) })]));
    await view;

    expect(screen.getByText('Total')).toBeOnTheScreen();
    expect(screen.getAllByLabelText('15.000 pesos')).not.toHaveLength(0);
    expect(screen.getByRole('header', { name: 'Lo que vendiste' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Lámina Colibrí, 15.000 pesos')).toBeOnTheScreen();
  });

  it('shows quantity times price when there is more than one', async () => {
    const { view } = renderDetail(
      makeSaleRecord([makeSaleItem(1, { quantity: 2, unitPrice: clp(15000) })]),
    );
    await view;

    expect(screen.getByText('2 × $15.000')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Lámina Colibrí, 2 de 15.000 pesos, 30.000 pesos'),
    ).toBeOnTheScreen();
  });

  it('adds the version name when the product has several', async () => {
    const { view } = renderDetail(
      makeSaleRecord([
        makeSaleItem(1, {
          productId: productId(2),
          productVersionId: versionId(2),
          quantity: 2,
          unitPrice: clp(15000),
        }),
      ]),
    );
    await view;

    expect(screen.getByText('Print A4 · 2 × $15.000')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Print, Print A4, 2 de 15.000 pesos, 30.000 pesos'),
    ).toBeOnTheScreen();
  });

  it('marks the item of an archived product', async () => {
    const archived = makeProduct(1, lamina.versions, {
      name: 'Lámina Colibrí',
      archivedAt: 1 as never,
    });
    const { view } = renderDetail(undefined, productsById(archived));
    await view;

    expect(screen.getByText('Archivado')).toBeOnTheScreen();
    expect(screen.getByLabelText('Lámina Colibrí, archivado, 15.000 pesos')).toBeOnTheScreen();
  });

  it('names an unknown product kindly and keeps its amount', async () => {
    const { view } = renderDetail(undefined, productsById());
    await view;

    expect(screen.getByLabelText('Producto sin nombre, archivado, 15.000 pesos')).toBeOnTheScreen();
  });

  it('shows the channel and the note only when they exist', async () => {
    const { view } = renderDetail(
      makeSaleRecord([makeSaleItem(1)], { channel: 'fair', note: 'Feria del parque' }),
    );
    await view;

    expect(screen.getByText('Dónde vendiste')).toBeOnTheScreen();
    expect(screen.getByText('Feria')).toBeOnTheScreen();
    expect(screen.getByText('Nota')).toBeOnTheScreen();
    expect(screen.getByText('Feria del parque')).toBeOnTheScreen();
  });

  it('hides the channel and note sections without them', async () => {
    const { view } = renderDetail();
    await view;

    expect(screen.queryByText('Dónde vendiste')).not.toBeOnTheScreen();
    expect(screen.queryByText('Nota')).not.toBeOnTheScreen();
  });

  it('asks to delete from the last button of the content', async () => {
    const { onDelete, view } = renderDetail();
    await view;

    await user.press(screen.getByRole('button', { name: 'Borrar venta' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
