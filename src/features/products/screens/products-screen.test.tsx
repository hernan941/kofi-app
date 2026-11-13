import { screen, userEvent } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { productIdSchema } from '@/shared/domain';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';

import { epoch, fixtureId, makeProduct, makeVersion } from '../domain/testing/product-fixtures';
import { ProductsScreen } from './products-screen';

const user = userEvent.setup();

function textOf(element: { props: { children?: unknown } }): string {
  return String(element.props.children);
}

const named = (name: string, n: number, archived = false) => {
  const id = productIdSchema.parse(fixtureId(n));
  return makeProduct([makeVersion(n, { productId: id })], {
    id,
    name,
    archivedAt: archived ? epoch(5) : null,
  });
};

function setup(dependencies = createTestDependencies()) {
  const handlers = { onAddProduct: jest.fn(), onOpenProduct: jest.fn(), onOpenArchived: jest.fn() };
  const view = renderWithProviders(<ProductsScreen {...handlers} />, { dependencies });
  return { ...handlers, dependencies, view };
}

describe('ProductsScreen', () => {
  it('shows the header and the loading state first', async () => {
    await setup().view;

    expect(screen.getByRole('header', { name: 'Productos' })).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Cargando productos' })).toBeOnTheScreen();
  });

  it('invites to create the first product when the list is empty', async () => {
    const { onAddProduct, view } = setup();
    await view;

    const title = await screen.findByText('Aquí vas a ver tus productos');
    expect(title).toBeOnTheScreen();
    expect(findGuiltPattern(textOf(title))).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver archivados' })).not.toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Agregar producto' })).toHaveLength(1);

    await user.press(screen.getByRole('button', { name: 'Agregar producto' }));
    expect(onAddProduct).toHaveBeenCalledTimes(1);
  });

  it('offers the archived products when only those exist', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save(named('Vieja', 2, true));
    const { onOpenArchived, view } = setup(dependencies);
    await view;

    const title = await screen.findByText('No tienes productos en tu lista');
    expect(title).toBeOnTheScreen();
    expect(findGuiltPattern(textOf(title))).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Ver archivados' }));
    expect(onOpenArchived).toHaveBeenCalledTimes(1);
  });

  it('lists the products sorted, opens one and shows the archived count only when positive', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save(named('Taza', 3));
    await dependencies.products.save(named('Álbum', 2));
    const { onOpenProduct, view } = setup(dependencies);
    await view;

    const rows = await screen.findAllByRole('button', { name: /, 1\.000 pesos$/ });
    expect(rows.map((row) => row.props.accessibilityLabel as string)).toEqual([
      'Álbum, 1.000 pesos',
      'Taza, 1.000 pesos',
    ]);
    expect(screen.queryByRole('button', { name: /Ver archivados/ })).not.toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Agregar producto' })).toHaveLength(1);

    await user.press(screen.getByRole('button', { name: 'Taza, 1.000 pesos' }));
    expect(onOpenProduct).toHaveBeenCalledWith(fixtureId(3));
  });

  it('shows "Ver archivados (n)" when there are archived products', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save(named('Taza', 3));
    await dependencies.products.save(named('Vieja', 4, true));
    await setup(dependencies).view;

    expect(await screen.findByRole('button', { name: 'Ver archivados (1)' })).toBeOnTheScreen();
  });

  it('shows an error with a retry', async () => {
    const dependencies = createTestDependencies();
    const failing = jest
      .spyOn(dependencies.products, 'listActive')
      .mockRejectedValueOnce(new Error('boom'));
    await setup(dependencies).view;

    expect(
      await screen.findByText('No se pudieron cargar tus productos. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Aquí vas a ver tus productos')).toBeOnTheScreen();
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
