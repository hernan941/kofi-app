import { screen } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { renderWithProviders } from '@/core/testing/render-with-providers';

import {
  PRODUCT_ID,
  clp,
  epoch,
  makeProduct,
  makeVersion,
} from '../domain/testing/product-fixtures';
import { testPhotoId } from '../testing/in-memory-photo-storage';
import { ProductDetail } from './product-detail';

const fixed = (price: number) => ({ mode: 'fixed', price: clp(price) }) as const;

describe('ProductDetail with a single version', () => {
  it('shows the description, the price with Amount and the cost, without saying "versión"', async () => {
    await renderUi(
      <ProductDetail
        product={makeProduct([makeVersion(0, { pricing: fixed(15000), cost: clp(3000) })], {
          description: 'Acuarela sobre papel',
        })}
      />,
    );

    expect(screen.getByText('Acuarela sobre papel')).toBeOnTheScreen();
    expect(screen.getByText('Precio')).toBeOnTheScreen();
    expect(screen.getByLabelText('15.000 pesos')).toBeOnTheScreen();
    expect(screen.getByText('Te cuesta hacerlo')).toBeOnTheScreen();
    expect(screen.getByLabelText('3.000 pesos')).toBeOnTheScreen();
    expect(screen.queryAllByText(/versi[oó]n/i)).toHaveLength(0);
  });

  it('explains a negotiable price and omits the description when there is none', async () => {
    await renderUi(
      <ProductDetail
        product={makeProduct([makeVersion(0, { pricing: { mode: 'negotiable' } })])}
      />,
    );

    expect(screen.getByText('A convenir')).toBeOnTheScreen();
    expect(screen.getByText('El precio lo escribes al registrar cada venta.')).toBeOnTheScreen();
    expect(screen.queryByText('Te cuesta hacerlo')).not.toBeOnTheScreen();
  });
});

describe('ProductDetail with several versions', () => {
  const product = makeProduct([
    makeVersion(0, { name: 'Print A4', pricing: fixed(15000) }),
    makeVersion(1, { name: 'Print A3', pricing: fixed(25000), cost: clp(3000) }),
    makeVersion(2, { name: 'Personalizado', pricing: { mode: 'negotiable' }, cost: clp(3000) }),
    makeVersion(3, { name: 'Vieja', archivedAt: epoch(5) }),
  ]);

  it('lists the active versions with the labels of the design and hides archived ones', async () => {
    await renderUi(<ProductDetail product={product} />);

    expect(screen.getByText('Versiones')).toBeOnTheScreen();
    expect(screen.getByLabelText('Print A4, 15.000 pesos')).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Print A3, 25.000 pesos, te cuesta 3.000 pesos'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Personalizado, precio a convenir, te cuesta 3.000 pesos'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Te cuesta $3.000', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByText('A convenir · te cuesta $3.000', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Vieja')).not.toBeOnTheScreen();
  });
});

describe('ProductDetail notices', () => {
  it('tells an archived product is archived', async () => {
    await renderUi(
      <ProductDetail product={makeProduct([makeVersion(0)], { archivedAt: epoch(9) })} />,
    );

    expect(
      screen.getByText(
        'Está archivado: no aparece en tu lista ni al registrar ventas. Tus ventas pasadas no cambian.',
      ),
    ).toBeOnTheScreen();
  });

  it('says there are no prices when there are no active versions', async () => {
    const { unmount } = await renderUi(<ProductDetail product={makeProduct([])} />);
    expect(
      screen.getByText('Este producto no tiene precios para vender. Edítalo para agregar uno.'),
    ).toBeOnTheScreen();
    await unmount();

    await renderUi(<ProductDetail product={makeProduct([], { archivedAt: epoch(9) })} />);
    expect(
      screen.getByText(
        'Este producto no tiene precios para vender. Edítalo para agregar uno y después podrás volver a usarlo.',
      ),
    ).toBeOnTheScreen();
  });
});

describe('ProductDetail photos', () => {
  it('shows the gallery of the product above the description', async () => {
    const photo = {
      id: testPhotoId(1),
      productId: PRODUCT_ID,
      position: 0,
      width: 100,
      height: 50,
      byteSize: 10,
      sha256: 'f'.repeat(64),
    };
    await renderWithProviders(
      <ProductDetail
        product={makeProduct([makeVersion(0)], { description: 'Acuarela', photos: [photo] })}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Foto 1 de 1 de Lámina, portada' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Acuarela')).toBeOnTheScreen();
  });

  it('draws no photos for a product without them', async () => {
    await renderUi(<ProductDetail product={makeProduct([makeVersion(0)])} />);

    expect(screen.queryAllByRole('image')).toHaveLength(0);
  });
});
