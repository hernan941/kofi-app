import { screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { productIdSchema } from '@/shared/domain';
import { renderUi } from '@/shared/ui/testing/render-ui';

import { fixtureId, makeProduct, makeVersion } from '../domain/testing/product-fixtures';
import { ProductList } from './product-list';

const user = userEvent.setup();

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
});
