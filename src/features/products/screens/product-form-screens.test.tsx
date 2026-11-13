import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { PRODUCT_ID, makeProduct, makeVersion, epoch } from '../domain/testing/product-fixtures';
import { EditProductScreen } from './edit-product-screen';
import { NewProductScreen } from './new-product-screen';

jest.mock('expo-router', () => ({ usePreventRemove: jest.fn() }));

const user = userEvent.setup();

describe('NewProductScreen', () => {
  it('saves a product, tells it and reports the id', async () => {
    const dependencies = createTestDependencies();
    const onSaved = jest.fn();
    await renderWithProviders(<NewProductScreen onBack={jest.fn()} onSaved={onSaved} />, {
      dependencies,
    });
    expect(screen.getByRole('header', { name: 'Nuevo producto' })).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Nombre'), 'Lámina Colibrí');
    await user.type(screen.getByLabelText('¿A cuánto lo vendes?'), '15000');
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect((await screen.findAllByText('Producto guardado')).length).toBeGreaterThan(0);
    const [saved] = await dependencies.products.listActive();
    expect(saved?.name).toBe('Lámina Colibrí');
    expect(onSaved).toHaveBeenCalledWith(saved?.id);
  });

  it('keeps what was typed and says so when saving fails unexpectedly', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.productWriter, 'saveSync').mockImplementation(() => {
      throw new Error('boom');
    });
    const onSaved = jest.fn();
    await renderWithProviders(<NewProductScreen onBack={jest.fn()} onSaved={onSaved} />, {
      dependencies,
    });
    await user.type(screen.getByLabelText('Nombre'), 'Lámina');
    await user.type(screen.getByLabelText('¿A cuánto lo vendes?'), '15000');

    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      (await screen.findAllByText('No se pudo guardar. Inténtalo de nuevo.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Lámina');
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('NewProductScreen photos after a failed save', () => {
  it('keeps the imported files so the retry saves rows that have their file', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a', 'b']);
    const saveSync = dependencies.productWriter.saveSync.bind(dependencies.productWriter);
    jest.spyOn(dependencies.productWriter, 'saveSync').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    jest.spyOn(dependencies.productWriter, 'saveSync').mockImplementation(saveSync);
    const onSaved = jest.fn();
    await renderWithProviders(<NewProductScreen onBack={jest.fn()} onSaved={onSaved} />, {
      dependencies,
    });
    await user.type(screen.getByLabelText('Nombre'), 'Lámina');
    await user.type(screen.getByLabelText('¿A cuánto lo vendes?'), '15000');
    await user.press(screen.getByRole('button', { name: 'Galería' }));
    await screen.findByText('2 de 6');

    await user.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      (await screen.findAllByText('No se pudo guardar. Inténtalo de nuevo.')).length,
    ).toBeGreaterThan(0);
    expect(dependencies.photos.fileIds()).toHaveLength(2);
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    const [saved] = await dependencies.products.listActive();
    expect(saved?.photos).toHaveLength(2);
    for (const photo of saved?.photos ?? []) {
      expect(dependencies.photos.hasFile(photo.id)).toBe(true);
    }
  });
});

describe('EditProductScreen', () => {
  const existing = makeProduct([makeVersion(0, { name: null })], { name: 'Lámina' });

  it('loads the values, saves the changes and tells it', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save(existing);
    const onSaved = jest.fn();
    await renderWithProviders(
      <EditProductScreen productId={PRODUCT_ID} onBack={jest.fn()} onSaved={onSaved} />,
      { dependencies },
    );

    const name = await screen.findByLabelText('Nombre');
    expect(name).toHaveDisplayValue('Lámina');
    expect(screen.getByRole('header', { name: 'Editar producto' })).toBeOnTheScreen();
    await user.clear(name);
    await user.type(name, 'Lámina Colibrí');
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect((await screen.findAllByText('Cambios guardados')).length).toBeGreaterThan(0);
    expect((await dependencies.products.findById(PRODUCT_ID))?.name).toBe('Lámina Colibrí');
    expect(onSaved).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it('warns that an archived product stays archived', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save({ ...existing, archivedAt: epoch(5) });
    await renderWithProviders(
      <EditProductScreen productId={PRODUCT_ID} onBack={jest.fn()} onSaved={jest.fn()} />,
      { dependencies },
    );

    expect(
      await screen.findByText(
        'Este producto está archivado. Puedes corregirlo y seguirá archivado hasta que elijas "Volver a usar".',
      ),
    ).toBeOnTheScreen();
  });

  it('shows the not-found state', async () => {
    const onBack = jest.fn();
    await renderWithProviders(
      <EditProductScreen productId={PRODUCT_ID} onBack={onBack} onSaved={jest.fn()} />,
    );

    expect((await screen.findAllByText('No encontramos este producto')).length).toBeGreaterThan(0);
    await user.press(screen.getByRole('button', { name: 'Ir a Productos' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('tells and goes back when the product disappeared before saving', async () => {
    const dependencies = createTestDependencies();
    await dependencies.products.save(existing);
    const onBack = jest.fn();
    await renderWithProviders(
      <EditProductScreen productId={PRODUCT_ID} onBack={onBack} onSaved={jest.fn()} />,
      { dependencies },
    );
    const name = await screen.findByLabelText('Nombre');
    jest.spyOn(dependencies.productWriter, 'findByIdSync').mockReturnValue(null);
    await user.type(name, ' 2');

    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      (await screen.findAllByText('No encontramos este producto. Puede que ya no exista.')).length,
    ).toBeGreaterThan(0);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
