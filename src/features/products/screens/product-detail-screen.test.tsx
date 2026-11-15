import { act, screen, userEvent } from '@testing-library/react-native';

import { DataChangesBridge } from '@/core/providers/query/data-changes-bridge';
import { QUERY_DEPENDENCIES } from '@/core/providers/query/query-dependencies';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { productIdSchema } from '@/shared/domain';

import {
  PRODUCT_ID,
  epoch,
  fixtureId,
  makeProduct,
  makeVersion,
} from '../domain/testing/product-fixtures';
import type { Product } from '../domain';
import { ProductDetailScreen } from './product-detail-screen';

const user = userEvent.setup();

async function setup(product: Product | null) {
  const dependencies = createTestDependencies();
  if (product) await dependencies.products.save(product);
  const handlers = { onBack: jest.fn(), onEdit: jest.fn(), onArchived: jest.fn() };
  await renderWithProviders(
    <>
      <DataChangesBridge dataChanges={dependencies.dataChanges} dependencies={QUERY_DEPENDENCIES} />
      <ProductDetailScreen productId={PRODUCT_ID} {...handlers} />
    </>,
    { dependencies },
  );
  return { ...handlers, dependencies };
}

const active = makeProduct([makeVersion(0, { name: null })], { name: 'Lámina Colibrí' });

describe('ProductDetailScreen of an active product', () => {
  it('shows the name as the title and the actions', async () => {
    const { onEdit } = await setup(active);

    expect(await screen.findByRole('header', { name: 'Lámina Colibrí' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Archivar' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Editar producto' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('archives after confirming and tells where to find it', async () => {
    const { onArchived, dependencies } = await setup(active);
    await user.press(await screen.findByRole('button', { name: 'Archivar' }));

    expect(screen.getByText('¿Archivar Lámina Colibrí?')).toBeOnTheScreen();
    expect(onArchived).not.toHaveBeenCalled();

    await user.press(screen.getAllByRole('button', { name: 'Archivar' }).at(-1) as never);

    expect(
      (
        await screen.findAllByText('Producto archivado. Lo encuentras en Archivados.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(onArchived).toHaveBeenCalledTimes(1);
    expect(await dependencies.products.listArchived()).toHaveLength(1);
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const { onArchived, dependencies } = await setup(active);
    await user.press(await screen.findByRole('button', { name: 'Archivar' }));

    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onArchived).not.toHaveBeenCalled();
    expect(await dependencies.products.listActive()).toHaveLength(1);
  });

  it('reports a failed archive and keeps the screen', async () => {
    const { onArchived, dependencies } = await setup(active);
    jest.spyOn(dependencies.productWriter, 'setArchivedSync').mockImplementation(() => {
      throw new Error('boom');
    });
    await user.press(await screen.findByRole('button', { name: 'Archivar' }));
    await user.press(screen.getAllByRole('button', { name: 'Archivar' }).at(-1) as never);

    expect(
      (
        await screen.findAllByText('No se pudo archivar. Inténtalo de nuevo.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(onArchived).not.toHaveBeenCalled();
  });
});

describe('ProductDetailScreen of an archived product', () => {
  const archived = makeProduct([makeVersion(0)], { name: 'Vieja', archivedAt: epoch(5) });

  it('offers "Volver a usar" and "Editar" and unarchives without asking', async () => {
    const { dependencies } = await setup(archived);

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Volver a usar' }));

    expect(
      (
        await screen.findAllByText('Listo, vuelve a estar en tu lista.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(await dependencies.products.listActive()).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'Archivar' })).toBeOnTheScreen();
  });

  it('ignores a second tap on "Volver a usar" while the first is in flight', async () => {
    const { dependencies } = await setup(archived);
    const button = await screen.findByRole('button', { name: 'Volver a usar' });
    const originalRun = dependencies.transactions.run.bind(dependencies.transactions);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = jest.spyOn(dependencies.transactions, 'run').mockImplementation(async (work) => {
      await gate;
      return originalRun(work);
    });

    await user.press(button);
    await user.press(button);
    await act(() => {
      release();
    });

    expect(
      (
        await screen.findAllByText('Listo, vuelve a estar en tu lista.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not offer "Volver a usar" without active versions', async () => {
    const { onEdit } = await setup(makeProduct([], { name: 'Rota', archivedAt: epoch(5) }));

    await screen.findByRole('header', { name: 'Rota' });
    expect(screen.queryByRole('button', { name: 'Volver a usar' })).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Editar producto' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe('ProductDetailScreen states', () => {
  it('shows the loading state', async () => {
    await setup(active);

    expect(screen.getByRole('progressbar', { name: 'Cargando producto' })).toBeOnTheScreen();
    await screen.findByRole('header', { name: 'Lámina Colibrí' });
  });

  it('says the product was not found and goes back', async () => {
    const { onBack } = await setup(null);

    expect((await screen.findAllByText('No encontramos este producto')).length).toBeGreaterThan(0);
    await user.press(screen.getByRole('button', { name: 'Ir a Productos' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows an error', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.products, 'findById').mockRejectedValueOnce(new Error('boom'));
    await renderWithProviders(
      <ProductDetailScreen
        productId={productIdSchema.parse(fixtureId(1))}
        onBack={jest.fn()}
        onEdit={jest.fn()}
        onArchived={jest.fn()}
      />,
      { dependencies },
    );

    expect(
      await screen.findByText('No se pudo cargar este producto. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();
  });
});
