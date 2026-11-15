import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { buildSaleRecordView, type SaleRecordView } from '@/features/sales';
import {
  clp,
  date,
  fixtureId,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
  productsById,
} from '@/features/sales/testing/sale-fixtures';
import { epochMsSchema, localDateSchema, saleRecordIdSchema } from '@/shared/domain';
import { renderUi } from '@/shared/ui/testing/render-ui';

import { LatestSalesList } from './latest-sales-list';

const user = userEvent.setup();
const today = localDateSchema.parse('2026-11-13');

const lamina = makeProduct(1, [makeVersion(1)], { name: 'Lámina Colibrí' });
const sticker = makeProduct(2, [makeVersion(2, { productN: 2 })], { name: 'Sticker' });
const archived = makeProduct(3, [makeVersion(3, { productN: 3 })], {
  name: 'Taza',
  archivedAt: epochMsSchema.parse(1_700_000_000_000),
});
const twoVersions = makeProduct(
  4,
  [
    makeVersion(4, { productN: 4, name: 'A4' }),
    makeVersion(5, { productN: 4, name: 'A3', position: 1 }),
  ],
  { name: 'Print' },
);
const catalog = productsById(lamina, sticker, archived, twoVersions);

function viewOf(
  n: number,
  soldOn: string,
  items: ReturnType<typeof makeSaleItem>[],
): SaleRecordView {
  return buildSaleRecordView(
    makeSaleRecord(items, { id: saleRecordIdSchema.parse(fixtureId(4, n)), soldOn: date(soldOn) }),
    catalog,
  );
}

const oneLamina = (n: number, soldOn: string) =>
  viewOf(n, soldOn, [makeSaleItem(n, { unitPrice: clp(15000) })]);

describe('LatestSalesList', () => {
  it('titles the card and shows the amount of each record', async () => {
    await renderUi(
      <LatestSalesList
        status="ready"
        sales={[oneLamina(1, '2026-11-13')]}
        today={today}
        onOpenSale={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByRole('header', { name: 'Últimas ventas' })).toBeOnTheScreen();
    expect(screen.getByText('$15.000', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('opens the detail of the pressed sale', async () => {
    const onOpenSale = jest.fn();
    await renderUi(
      <LatestSalesList
        status="ready"
        sales={[oneLamina(1, '2026-11-13'), oneLamina(2, '2026-11-09')]}
        today={today}
        onOpenSale={onOpenSale}
        onRetry={jest.fn()}
      />,
    );

    await user.press(
      screen.getByRole('button', {
        name: 'Lámina Colibrí, lunes 9 de noviembre, 15.000 pesos',
      }),
    );

    expect(onOpenSale).toHaveBeenCalledWith(saleRecordIdSchema.parse(fixtureId(4, 2)));
  });

  it('writes a short date as subtitle and a full date in the label', async () => {
    await renderUi(
      <LatestSalesList
        status="ready"
        sales={[oneLamina(1, '2026-11-13'), oneLamina(2, '2026-11-12'), oneLamina(3, '2025-12-28')]}
        today={today}
        onOpenSale={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Hoy', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Ayer', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByText('28 de diciembre de 2025', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Lámina Colibrí, hoy, viernes 13 de noviembre, 15.000 pesos',
      }),
    ).toBeOnTheScreen();
  });

  it('says how many more products a record has', async () => {
    const many = viewOf(1, '2026-11-13', [
      makeSaleItem(1, { unitPrice: clp(15000) }),
      makeSaleItem(2, {
        productId: sticker.id,
        productVersionId: makeVersion(2).id,
        unitPrice: clp(15000),
      }),
      makeSaleItem(3, {
        productId: sticker.id,
        productVersionId: makeVersion(2).id,
        unitPrice: clp(15000),
      }),
    ]);
    await renderUi(
      <LatestSalesList
        status="ready"
        sales={[many]}
        today={today}
        onOpenSale={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(
      screen.getByText('Lámina Colibrí y 2 más', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', {
        name: 'Lámina Colibrí y 2 más, hoy, viernes 13 de noviembre, 45.000 pesos',
      }),
    ).toBeOnTheScreen();
  });

  it('shows the current name and "Archivado" in text for an archived product', async () => {
    const sale = viewOf(1, '2026-11-13', [
      makeSaleItem(1, { productId: archived.id, productVersionId: makeVersion(3).id }),
    ]);
    await renderUi(
      <LatestSalesList
        status="ready"
        sales={[sale]}
        today={today}
        onOpenSale={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Hoy · Archivado', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: /^Taza, .*archivado, 1\.000 pesos$/ }),
    ).toBeOnTheScreen();
  });

  it('shows the version when the product has several', async () => {
    const sale = viewOf(1, '2026-11-13', [
      makeSaleItem(1, { productId: twoVersions.id, productVersionId: makeVersion(4).id }),
    ]);
    await renderUi(
      <LatestSalesList
        status="ready"
        sales={[sale]}
        today={today}
        onOpenSale={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('A4 · Hoy', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('calls an unknown product "Producto sin nombre"', async () => {
    const sale = buildSaleRecordView(
      makeSaleRecord([makeSaleItem(1, { productId: makeProduct(9, []).id })], {
        soldOn: date('2026-11-13'),
      }),
      new Map(),
    );
    await renderUi(
      <LatestSalesList
        status="ready"
        sales={[sale]}
        today={today}
        onOpenSale={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(
      screen.getByText('Producto sin nombre', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('shows a record with a total of $0', async () => {
    const sale = viewOf(1, '2026-11-13', [makeSaleItem(1, { unitPrice: clp(0) })]);
    await renderUi(
      <LatestSalesList
        status="ready"
        sales={[sale]}
        today={today}
        onOpenSale={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('$0', { includeHiddenElements: true })).toHaveTextContent('$0');
  });

  it('announces the load error as a problem', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderUi(
      <LatestSalesList
        status="error"
        sales={[]}
        today={today}
        onOpenSale={jest.fn()}
        onRetry={jest.fn()}
      />,
    );

    expect(announce).toHaveBeenCalledWith('No se pudieron cargar tus últimas ventas.');
  });

  it('shows a notice with a retry when the latest sales failed to load', async () => {
    const onRetry = jest.fn();
    await renderUi(
      <LatestSalesList
        status="error"
        sales={[]}
        today={today}
        onOpenSale={jest.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('No se pudieron cargar tus últimas ventas.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
