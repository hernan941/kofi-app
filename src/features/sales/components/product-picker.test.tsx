import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { renderWithProviders } from '@/core/testing/render-with-providers';

import { clp, makeProduct, makeVersion } from '../domain/testing/sale-fixtures';
import { ProductPicker, ProductPickerSheet } from './product-picker';

const user = userEvent.setup();

const single = makeProduct(1, [makeVersion(1, { pricing: { mode: 'fixed', price: clp(15000) } })], {
  name: 'Lámina Colibrí',
});
const negotiable = makeProduct(
  2,
  [makeVersion(2, { productN: 2, pricing: { mode: 'negotiable' } })],
  { name: 'Retrato' },
);
const several = makeProduct(
  3,
  [
    makeVersion(3, {
      productN: 3,
      name: 'Print A4',
      pricing: { mode: 'fixed', price: clp(10000) },
    }),
    makeVersion(4, {
      productN: 3,
      name: 'Print A3',
      pricing: { mode: 'fixed', price: clp(18000) },
    }),
    makeVersion(5, { productN: 3, name: 'Personalizado', pricing: { mode: 'negotiable' } }),
  ],
  { name: 'Print' },
);
const allNegotiable = makeProduct(
  4,
  [
    makeVersion(6, { productN: 4, name: 'A', pricing: { mode: 'negotiable' } }),
    makeVersion(7, { productN: 4, name: 'B', pricing: { mode: 'negotiable' } }),
  ],
  { name: 'Mural' },
);

const catalogOf300 = Array.from({ length: 300 }, (_, index) =>
  makeProduct(100 + index, [makeVersion(100 + index, { productN: 100 + index })], {
    name: `Producto ${String(index)}`,
  }),
);

describe('ProductPicker', () => {
  it('describes each row like the products list', async () => {
    await renderWithProviders(
      <ProductPicker
        products={[single, negotiable, several, allNegotiable]}
        showThumbnails={false}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retrato, precio a convenir' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Print, 3 versiones, desde 10.000 pesos' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Mural, 2 versiones, precio a convenir' }),
    ).toBeOnTheScreen();
  });

  it('reports the product that was pressed', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(
      <ProductPicker products={[single, negotiable]} showThumbnails={false} onSelect={onSelect} />,
    );

    await user.press(screen.getByRole('button', { name: 'Retrato, precio a convenir' }));

    expect(onSelect).toHaveBeenCalledWith(negotiable);
  });

  it('has no search with fewer than ten products', async () => {
    await renderWithProviders(
      <ProductPicker products={[single]} showThumbnails={false} onSelect={jest.fn()} />,
    );

    expect(screen.queryByLabelText('Buscar producto')).not.toBeOnTheScreen();
  });

  it('renders only the first products inline and invites to search for the rest', async () => {
    await renderWithProviders(
      <ProductPicker products={catalogOf300} showThumbnails={false} onSelect={jest.fn()} />,
    );

    const rows = screen.getAllByRole('button', { name: /^Producto \d+/ });
    expect(rows.length).toBeLessThan(50);
    expect(screen.getByText(/Mostrando \d+ de 300 productos/)).toBeOnTheScreen();
  });

  it('finds a product beyond the inline limit by searching', async () => {
    await renderWithProviders(
      <ProductPicker products={catalogOf300} showThumbnails={false} onSelect={jest.fn()} />,
    );

    await user.type(screen.getByLabelText('Buscar producto'), 'Producto 299');

    expect(screen.getByRole('button', { name: /Producto 299/ })).toBeOnTheScreen();
  });

  describe('with ten or more products', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      makeProduct(10 + index, [makeVersion(10 + index, { productN: 10 + index })], {
        name: index === 0 ? 'Álbum de fotos' : `Producto ${String(index)}`,
      }),
    );

    it('filters by name ignoring case and accents', async () => {
      await renderWithProviders(
        <ProductPicker products={many} showThumbnails={false} onSelect={jest.fn()} />,
      );

      await user.type(screen.getByLabelText('Buscar producto'), 'ALBUM');

      expect(screen.getByRole('button', { name: /Álbum de fotos/ })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /Producto 1/ })).not.toBeOnTheScreen();
    });

    it('says so kindly when nothing matches', async () => {
      await renderWithProviders(
        <ProductPicker products={many} showThumbnails={false} onSelect={jest.fn()} />,
      );

      await user.type(screen.getByLabelText('Buscar producto'), 'zzz');

      expect(screen.getByText('No encontramos productos con "zzz".')).toBeOnTheScreen();
    });
  });
});

describe('ProductPickerSheet', () => {
  function renderSheet(initialProduct?: typeof several) {
    const onPick = jest.fn();
    const onClose = jest.fn();
    const view = renderWithProviders(
      <ProductPickerSheet
        isOpen
        products={[single, several]}
        initialProduct={initialProduct}
        showThumbnails={false}
        onPick={onPick}
        onClose={onClose}
      />,
    );
    return { onPick, onClose, view };
  }

  it('virtualizes the list: 300 products are not all rendered at once', async () => {
    await renderWithProviders(
      <ProductPickerSheet
        isOpen
        products={catalogOf300}
        showThumbnails={false}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const rows = screen.getAllByRole('button', { name: /^Producto \d+/ });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(50);
  });

  it('lets the list shrink before the search field: the list and its container both shrink', async () => {
    await renderWithProviders(
      <ProductPickerSheet
        isOpen
        products={catalogOf300}
        showThumbnails={false}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const classNames: string[] = [];
    let node = screen.getAllByRole('button', { name: /^Producto \d+/ })[0]?.parent ?? null;
    while (node !== null) {
      const { className } = node.props as { className?: unknown };
      if (typeof className === 'string') classNames.push(className);
      node = node.parent;
    }

    const list = classNames.find((className) => className.includes('max-h-96'));
    const container = classNames.find((className) => className.includes('gap-3'));
    expect(list).toContain('shrink');
    expect(container).toContain('shrink');
  });

  it('finds a product that is not rendered yet by searching in the sheet', async () => {
    await renderWithProviders(
      <ProductPickerSheet
        isOpen
        products={catalogOf300}
        showThumbnails={false}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Buscar producto'), 'Producto 299');

    expect(screen.getByRole('button', { name: /Producto 299/ })).toBeOnTheScreen();
  });

  it('picks the only version of a product right away', async () => {
    const { onPick, view } = renderSheet();
    await view;

    expect(screen.getByRole('header', { name: '¿Qué más vendiste?' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));

    expect(onPick).toHaveBeenCalledWith(single, single.versions[0]);
  });

  it('asks for the version of a product with several, with a way back to the list', async () => {
    const { onPick, view } = renderSheet();
    await view;

    await user.press(screen.getByRole('button', { name: /Print, 3 versiones/ }));

    expect(screen.getByRole('header', { name: '¿Qué versión de Print?' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Print A4, 10.000 pesos' })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Personalizado, precio a convenir' }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Print A3, 18.000 pesos' }));
    expect(onPick).toHaveBeenCalledWith(several, several.versions[1]);
  });

  it('moves the screen reader focus to the new title when the step changes', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    const { view } = renderSheet();
    await view;
    expect(spy.mock.calls).toHaveLength(0);

    await user.press(screen.getByRole('button', { name: /Print, 3 versiones/ }));
    expect(spy.mock.calls).toHaveLength(1);

    await user.press(screen.getByRole('button', { name: 'Ver todos los productos' }));
    expect(spy.mock.calls).toHaveLength(2);
    expect(spy.mock.calls[1]?.[1]).toBe('focus');
  });

  it('goes back to all the products from the version step', async () => {
    const { view } = renderSheet();
    await view;
    await user.press(screen.getByRole('button', { name: /Print, 3 versiones/ }));

    await user.press(screen.getByRole('button', { name: 'Ver todos los productos' }));

    expect(screen.getByRole('header', { name: '¿Qué más vendiste?' })).toBeOnTheScreen();
  });

  it('opens straight on the version step without a way back', async () => {
    const { view } = renderSheet(several);
    await view;

    expect(screen.getByRole('header', { name: '¿Qué versión de Print?' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ver todos los productos' })).not.toBeOnTheScreen();
  });

  it('lists only the active versions', async () => {
    const withArchived = makeProduct(
      3,
      [
        makeVersion(3, { productN: 3, name: 'Print A4' }),
        makeVersion(4, { productN: 3, name: 'Viejo', archivedAt: 1 as never }),
      ],
      { name: 'Print' },
    );
    await renderWithProviders(
      <ProductPickerSheet
        isOpen
        products={[withArchived]}
        initialProduct={withArchived}
        showThumbnails={false}
        onPick={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByText('Viejo')).not.toBeOnTheScreen();
  });
});
