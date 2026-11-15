import { screen, userEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/core/testing/render-with-providers';
import { renderUi } from '@/shared/ui/testing/render-ui';

import type { ProductPhoto } from '../domain';
import { clp, makeProduct, makeVersion, PRODUCT_ID } from '../domain/testing/product-fixtures';
import { testPhotoId } from '../testing/in-memory-photo-storage';
import { ProductListItem } from './product-list-item';

const user = userEvent.setup();
const coverOf = (n: number): ProductPhoto => ({
  id: testPhotoId(n),
  productId: PRODUCT_ID,
  position: 0,
  width: 100,
  height: 50,
  byteSize: 10,
  sha256: 'e'.repeat(64),
});
const fixed = (price: number) => ({ mode: 'fixed', price: clp(price) }) as const;
const negotiable = { mode: 'negotiable' } as const;

describe('ProductListItem', () => {
  it('shows the price of a single fixed version with Amount', async () => {
    const onPress = jest.fn();
    await renderUi(
      <ProductListItem
        product={makeProduct([makeVersion(0, { pricing: fixed(15000) })], {
          name: 'Lámina Colibrí',
        })}
        onPress={onPress}
      />,
    );

    expect(screen.getByText('$15.000', { includeHiddenElements: true })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says "A convenir" for a single negotiable version', async () => {
    await renderUi(
      <ProductListItem
        product={makeProduct([makeVersion(0, { pricing: negotiable })], { name: 'Lámina Colibrí' })}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('A convenir', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Lámina Colibrí, precio a convenir' }),
    ).toBeOnTheScreen();
  });

  it('shows "desde" with the lowest fixed price for several versions', async () => {
    await renderUi(
      <ProductListItem
        product={makeProduct(
          [
            makeVersion(0, { name: 'A', pricing: fixed(45000) }),
            makeVersion(1, { name: 'B', pricing: fixed(10000) }),
            makeVersion(2, { name: 'C', pricing: negotiable }),
          ],
          { name: 'Lámina Colibrí' },
        )}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('3 versiones', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('desde', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('$10.000', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Lámina Colibrí, 3 versiones, desde 10.000 pesos' }),
    ).toBeOnTheScreen();
  });

  it('describes several versions that are all negotiable', async () => {
    await renderUi(
      <ProductListItem
        product={makeProduct(
          [
            makeVersion(0, { name: 'A', pricing: negotiable }),
            makeVersion(1, { name: 'B', pricing: negotiable }),
          ],
          { name: 'Lámina' },
        )}
        onPress={jest.fn()}
      />,
    );

    expect(
      screen.getByText('2 versiones · a convenir', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Lámina, 2 versiones, precio a convenir' }),
    ).toBeOnTheScreen();
  });

  it('shows $0 as a price', async () => {
    await renderUi(
      <ProductListItem
        product={makeProduct([makeVersion(0, { pricing: fixed(0) })], { name: 'Regalo' })}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('$0', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('tolerates a product without active versions', async () => {
    await renderUi(
      <ProductListItem product={makeProduct([], { name: 'Lámina' })} onPress={jest.fn()} />,
    );

    expect(
      screen.getByText('Sin precio por ahora', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lámina, sin precio por ahora' })).toBeOnTheScreen();
  });

  it('draws no thumbnail unless the list asks for it', async () => {
    await renderWithProviders(
      <ProductListItem
        product={makeProduct([makeVersion(0)], { name: 'Lámina', photos: [coverOf(1)] })}
        onPress={jest.fn()}
      />,
    );

    expect(
      screen.queryByLabelText('Foto del producto', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
  });

  it('draws the cover as a decorative thumbnail when the list shows thumbnails', async () => {
    await renderWithProviders(
      <ProductListItem
        showThumbnail
        product={makeProduct([makeVersion(0)], { name: 'Lámina', photos: [coverOf(1)] })}
        onPress={jest.fn()}
      />,
    );

    expect(
      screen.getByLabelText('Foto del producto', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lámina, 1.000 pesos' })).toBeOnTheScreen();
  });

  it('keeps the name aligned with a neutral box when the product has no photo', async () => {
    await renderWithProviders(
      <ProductListItem
        showThumbnail
        product={makeProduct([makeVersion(0)], { name: 'Lámina' })}
        onPress={jest.fn()}
      />,
    );

    expect(
      screen.queryByLabelText('Foto del producto', { includeHiddenElements: true }),
    ).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lámina, 1.000 pesos' })).toBeOnTheScreen();
  });
});
