import { screen, userEvent } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { productIdSchema, type ProductId } from '@/shared/domain';

import { epoch, fixtureId, makeProduct, makeVersion } from '../domain/testing/product-fixtures';
import { testPhotoId } from '../testing/in-memory-photo-storage';
import { ArchivedProductsScreen } from './archived-products-screen';

const coverDiff = (id: ProductId) => ({
  inserted: [
    {
      id: testPhotoId(1),
      productId: id,
      position: 0,
      width: 100,
      height: 50,
      byteSize: 10,
      sha256: 'e'.repeat(64),
    },
  ],
  moved: [],
  removed: [],
});

const user = userEvent.setup();

describe('ArchivedProductsScreen', () => {
  it('shows the empty state', async () => {
    await renderWithProviders(
      <ArchivedProductsScreen onBack={jest.fn()} onOpenProduct={jest.fn()} />,
    );

    expect(screen.getByRole('header', { name: 'Archivados' })).toBeOnTheScreen();
    expect(await screen.findByText('No tienes productos archivados')).toBeOnTheScreen();
    expect(screen.queryByText(/Aquí guardas lo que ya no vendes/)).not.toBeOnTheScreen();
  });

  it('lists the archived products with the introduction and opens one', async () => {
    const dependencies = createTestDependencies();
    const id = productIdSchema.parse(fixtureId(2));
    await dependencies.products.save(
      makeProduct([makeVersion(2, { productId: id })], { id, name: 'Vieja', archivedAt: epoch(5) }),
    );
    const onOpenProduct = jest.fn();
    const onBack = jest.fn();
    await renderWithProviders(
      <ArchivedProductsScreen onBack={onBack} onOpenProduct={onOpenProduct} />,
      { dependencies },
    );

    expect(
      await screen.findByText(
        'Aquí guardas lo que ya no vendes. Tus ventas pasadas no cambian y puedes volver a usar cualquiera.',
      ),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Vieja, 1.000 pesos' }));
    expect(onOpenProduct).toHaveBeenCalledWith(id);

    await user.press(screen.getByRole('button', { name: 'Volver' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows an error', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.products, 'listArchived').mockRejectedValueOnce(new Error('boom'));
    await renderWithProviders(
      <ArchivedProductsScreen onBack={jest.fn()} onOpenProduct={jest.fn()} />,
      {
        dependencies,
      },
    );

    expect(
      await screen.findByText('No se pudieron cargar tus archivados. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();
  });

  it('shows the cover thumbnail of an archived product that has a photo (UX-F7)', async () => {
    const dependencies = createTestDependencies();
    const id = productIdSchema.parse(fixtureId(2));
    await dependencies.products.save(
      makeProduct([makeVersion(2, { productId: id })], {
        id,
        name: 'Vieja',
        archivedAt: epoch(5),
      }),
    );
    dependencies.products.savePhotosSync(id, coverDiff(id), epoch(6));
    await renderWithProviders(
      <ArchivedProductsScreen onBack={jest.fn()} onOpenProduct={jest.fn()} />,
      { dependencies },
    );

    await screen.findByRole('button', { name: 'Vieja, 1.000 pesos' });
    expect(
      screen.getAllByLabelText('Foto del producto', { includeHiddenElements: true }),
    ).toHaveLength(1);
  });
});
