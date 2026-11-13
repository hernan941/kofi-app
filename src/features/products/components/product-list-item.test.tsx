import { screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { clp, makeProduct, makeVersion } from '../domain/testing/product-fixtures';
import { ProductListItem } from './product-list-item';

const user = userEvent.setup();
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

    expect(screen.getByText('$15.000')).toBeOnTheScreen();
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

    expect(screen.getByText('A convenir')).toBeOnTheScreen();
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

    expect(screen.getByText('3 versiones')).toBeOnTheScreen();
    expect(screen.getByText('desde')).toBeOnTheScreen();
    expect(screen.getByText('$10.000')).toBeOnTheScreen();
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

    expect(screen.getByText('2 versiones · a convenir')).toBeOnTheScreen();
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

    expect(screen.getByText('$0')).toBeOnTheScreen();
  });

  it('tolerates a product without active versions', async () => {
    await renderUi(
      <ProductListItem product={makeProduct([], { name: 'Lámina' })} onPress={jest.fn()} />,
    );

    expect(screen.getByText('Sin precio por ahora')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lámina, sin precio por ahora' })).toBeOnTheScreen();
  });
});
