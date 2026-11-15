import { screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { productIdSchema } from '@/shared/domain';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { renderUi } from '@/shared/ui/testing/render-ui';

import type { ProductPhoto } from '../domain';
import {
  fixtureId,
  makeProduct,
  makeVersion,
  PRODUCT_ID,
} from '../domain/testing/product-fixtures';
import { testPhotoId } from '../testing/in-memory-photo-storage';
import { ProductList } from './product-list';

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

const named = (name: string, n: number) => {
  const id = productIdSchema.parse(fixtureId(n));
  return makeProduct([makeVersion(n, { productId: id })], { id, name });
};

describe('ProductList', () => {
  it('shows a row per product in the given order and opens the pressed one', async () => {
    const onOpenProduct = jest.fn();
    const taza = named('Taza', 2);
    await renderUi(
      <ProductList products={[named('Álbum', 3), taza]} onOpenProduct={onOpenProduct} />,
    );

    const rows = screen.getAllByRole('button');
    expect(rows.map((row) => row.props.accessibilityLabel as string)).toEqual([
      'Álbum, 1.000 pesos',
      'Taza, 1.000 pesos',
    ]);

    await user.press(screen.getByRole('button', { name: 'Taza, 1.000 pesos' }));
    expect(onOpenProduct).toHaveBeenCalledWith(taza.id);
  });

  it('draws the footer after the rows', async () => {
    await renderUi(
      <ProductList
        products={[named('Taza', 2)]}
        onOpenProduct={jest.fn()}
        footer={<Text>Pie</Text>}
      />,
    );

    expect(screen.getByText('Pie')).toBeOnTheScreen();
  });

  it('shows no thumbnails when no product has a cover (UX-F7)', async () => {
    await renderWithProviders(
      <ProductList products={[named('Álbum', 3), named('Taza', 2)]} onOpenProduct={jest.fn()} />,
    );

    expect(
      screen.queryAllByLabelText('Foto del producto', { includeHiddenElements: true }),
    ).toHaveLength(0);
  });

  it('shows a cover for the product that has one when any product has one', async () => {
    const withCover = { ...named('Álbum', 3), photos: [coverOf(1)] };
    await renderWithProviders(
      <ProductList products={[withCover, named('Taza', 2)]} onOpenProduct={jest.fn()} />,
    );

    expect(
      screen.getAllByLabelText('Foto del producto', { includeHiddenElements: true }),
    ).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
