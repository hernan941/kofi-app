import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { ok, productIdSchema } from '@/shared/domain';
import { FORM_ERRORS_ANNOUNCEMENT } from '@/shared/ui';
import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { PRODUCT_ID, makeProduct, makeVersion } from '../domain/testing/product-fixtures';
import { ProductForm, type ProductFormProps } from './product-form';
import { toProductFormValues, type UpdateProductFormOutput } from './product-form-schema';

jest.mock('expo-router', () => ({ usePreventRemove: jest.fn() }));

const user = userEvent.setup();

const NAME = 'Nombre';
const PRICE = '¿A cuánto lo vendes?';

function setup(props: Partial<ProductFormProps> = {}) {
  const onSubmit = jest.fn((_output: UpdateProductFormOutput) => Promise.resolve(ok(PRODUCT_ID)));
  const onSaved = jest.fn();
  const onUnmappedErrors = jest.fn();
  const element = (
    <ProductForm
      initialValues={toProductFormValues(null)}
      onSubmit={onSubmit}
      onSaved={onSaved}
      onUnmappedErrors={onUnmappedErrors}
      {...props}
    />
  );
  return { element, onSubmit, onSaved, onUnmappedErrors };
}

async function pressRemove(index: number): Promise<void> {
  const button = screen.getAllByRole('button', { name: 'Quitar versión' }).at(index);
  if (button === undefined) {
    throw new Error('No remove button at that position.');
  }
  await user.press(button);
}

describe('ProductForm with a single version', () => {
  it('never says "versión"', async () => {
    await renderWithProviders(setup().element);

    expect(screen.queryAllByText(/versi[oó]n/i)).toHaveLength(0);
    expect(screen.queryByLabelText(/versi[oó]n/i)).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Agregar otra opción' })).toBeOnTheScreen();
  });

  it('shows the cost field only after "Agregar costo"', async () => {
    await renderWithProviders(setup().element);
    expect(screen.queryByLabelText('¿Cuánto te cuesta hacerlo? (opcional)')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Agregar costo' }));

    expect(screen.getByLabelText('¿Cuánto te cuesta hacerlo? (opcional)')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Agregar costo' })).not.toBeOnTheScreen();
  });

  it('hides the price when "A convenir" is chosen and brings it back', async () => {
    await renderWithProviders(setup().element);
    await user.type(screen.getByLabelText(PRICE), '15000');

    await user.press(screen.getByRole('radio', { name: 'A convenir' }));
    expect(screen.queryByLabelText(PRICE)).not.toBeOnTheScreen();
    expect(screen.getByText('El precio lo escribes al registrar cada venta.')).toBeOnTheScreen();

    await user.press(screen.getByRole('radio', { name: 'Precio fijo' }));
    expect(screen.getByLabelText(PRICE)).toHaveDisplayValue('15.000');
  });

  it('marks the fields with a message and an icon when saving without data', async () => {
    const { element, onSubmit } = setup();
    await renderWithProviders(element);

    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Escribe el nombre del producto')).toBeOnTheScreen();
    expect(screen.getByLabelText(NAME)).toHaveProp(
      'accessibilityHint',
      'Escribe el nombre del producto',
    );
    expect(screen.getByText('Escribe un monto, por ejemplo 15.000')).toBeOnTheScreen();
    expect(
      screen.getAllByTestId('phosphor-react-native-warning-circle-bold', {
        includeHiddenElements: true,
      }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends the output and reports the saved id', async () => {
    const { element, onSubmit, onSaved } = setup();
    await renderWithProviders(element);
    await user.type(screen.getByLabelText(NAME), 'Lámina Colibrí');
    await user.type(screen.getByLabelText(PRICE), '15000');

    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByRole('button', { name: 'Guardar' });
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Lámina Colibrí',
      description: null,
      versions: [{ name: null, pricing: { mode: 'fixed', price: 15000 }, cost: null }],
      removedVersionIds: [],
      photos: [],
    });
    expect(onSaved).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it('puts domain errors in their field', async () => {
    const { element } = setup({
      onSubmit: () => Promise.resolve({ ok: false, error: [{ code: 'required', path: ['name'] }] }),
    });
    await renderWithProviders(element);
    await user.type(screen.getByLabelText(NAME), 'Lámina');
    await user.type(screen.getByLabelText(PRICE), '15000');

    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Escribe el nombre del producto')).toBeOnTheScreen();
  });

  it('announces that the form has errors when the domain rejects the save', async () => {
    const announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { element } = setup({
      onSubmit: () =>
        Promise.resolve({
          ok: false,
          error: [
            { code: 'required', path: ['name'] },
            { code: 'too_long', path: ['description'] },
          ],
        }),
    });
    await renderWithProviders(element);
    await user.type(screen.getByLabelText(NAME), 'Lámina');
    await user.type(screen.getByLabelText(PRICE), '15000');

    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    await screen.findByText('Escribe el nombre del producto');
    expect(announceSpy).toHaveBeenCalledWith(FORM_ERRORS_ANNOUNCEMENT);
  });
});

describe('ProductForm with several versions', () => {
  it('names the first one "Estándar" and adds an empty one', async () => {
    await renderWithProviders(setup().element);

    await user.press(screen.getByRole('button', { name: 'Agregar otra opción' }));

    const names = screen.getAllByLabelText('Nombre de la versión');
    expect(names).toHaveLength(2);
    expect(names[0]).toHaveDisplayValue('Estándar');
    expect(names[1]).toHaveDisplayValue('');
    expect(screen.getByText('Versiones')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Quitar versión' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Agregar otra versión' })).toBeOnTheScreen();
  });

  it('removes a new version at once and goes back to the single layout', async () => {
    await renderWithProviders(setup().element);
    await user.press(screen.getByRole('button', { name: 'Agregar otra opción' }));

    await pressRemove(1);

    expect(screen.queryByText('Cancelar')).not.toBeOnTheScreen();
    expect(screen.queryAllByLabelText('Nombre de la versión')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Agregar otra opción' })).toBeOnTheScreen();
  });
});

describe('ProductForm focus after removing a version', () => {
  it('moves the screen reader focus to the add button after removing a new version', async () => {
    const setFocus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
    await renderWithProviders(setup().element);
    await user.press(screen.getByRole('button', { name: 'Agregar otra opción' }));
    setFocus.mockClear();

    await pressRemove(1);

    await waitFor(() => {
      expect(setFocus).toHaveBeenCalledTimes(1);
    });
  });

  it('moves it after the person confirms removing an existing version', async () => {
    const setFocus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockReturnValue();
    const product = makeProduct([
      makeVersion(0, { name: 'Print A4' }),
      makeVersion(1, { name: 'Print A3' }),
      makeVersion(2, { name: 'Print A2' }),
    ]);
    await renderWithProviders(setup({ initialValues: toProductFormValues(product) }).element);
    await pressRemove(2);
    expect(setFocus).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Quitar' }));

    await waitFor(() => {
      expect(setFocus).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ProductForm removing an existing version', () => {
  const product = makeProduct([
    makeVersion(0, { name: 'Print A4' }),
    makeVersion(1, { name: 'Print A3' }),
  ]);
  const idOfA3 = makeVersion(1).id;

  it('asks before and explains the history when it has sales', async () => {
    const { element, onSubmit } = setup({
      initialValues: toProductFormValues(product),
      productId: productIdSchema.parse(PRODUCT_ID),
      versionIdsWithSales: new Set([idOfA3]),
    });
    await renderWithProviders(element);

    await pressRemove(1);

    expect(screen.getByText('¿Quitar Print A3?')).toBeOnTheScreen();
    expect(screen.getByText(/queda guardada en tu historial/)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Quitar' }));
    expect(screen.queryByText('¿Quitar Print A3?')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByRole('button', { name: 'Guardar' });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ removedVersionIds: [idOfA3] }));
  });

  it('says it is deleted when there are no sales and hedges when unknown', async () => {
    const withoutSales = setup({
      initialValues: toProductFormValues(product),
      versionIdsWithSales: new Set(),
    });
    const { unmount } = await renderWithProviders(withoutSales.element);
    await pressRemove(1);
    expect(screen.getByText('Se borra cuando guardes los cambios.')).toBeOnTheScreen();
    await unmount();

    await renderWithProviders(setup({ initialValues: toProductFormValues(product) }).element);
    await pressRemove(1);
    expect(screen.getByText(/Si ya la vendiste/)).toBeOnTheScreen();
  });

  it('keeps the version when the person cancels', async () => {
    await renderWithProviders(setup({ initialValues: toProductFormValues(product) }).element);
    await pressRemove(1);

    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getAllByLabelText('Nombre de la versión')).toHaveLength(2);
  });
});

describe('ProductForm photos', () => {
  async function fillRequired() {
    await user.type(screen.getByLabelText(NAME), 'Lámina Colibrí');
    await user.type(screen.getByLabelText(PRICE), '15000');
  }

  function importedPhotoIds(dependencies: ReturnType<typeof createTestDependencies>) {
    return dependencies.photos.fileIds();
  }

  it('sends the photos in the order of the grid', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a', 'b']);
    const { element, onSubmit } = setup();
    await renderWithProviders(element, { dependencies });
    await fillRequired();
    await user.press(screen.getByRole('button', { name: 'Galería' }));
    await screen.findByText('2 de 6');
    await user.press(screen.getByRole('button', { name: 'Foto 2 de 2' }));
    await user.press(screen.getByRole('button', { name: 'Usar como portada' }));

    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    const [first, second] = importedPhotoIds(dependencies);
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    const sent = onSubmit.mock.calls[0]?.[0].photos.map((photo) => photo.id);
    expect(sent).toEqual([second, first]);
  });

  it('discards the files imported but not saved when the form is left', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a']);
    const view = await renderWithProviders(setup().element, { dependencies });
    await user.press(screen.getByRole('button', { name: 'Galería' }));
    await screen.findByText('1 de 6');
    expect(importedPhotoIds(dependencies)).toHaveLength(1);

    await view.unmount();

    await waitFor(() => {
      expect(importedPhotoIds(dependencies)).toHaveLength(0);
    });
  });

  it('keeps the files after a successful save', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a']);
    const { element, onSaved } = setup();
    const view = await renderWithProviders(element, { dependencies });
    await fillRequired();
    await user.press(screen.getByRole('button', { name: 'Galería' }));
    await screen.findByText('1 de 6');
    await user.press(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    await view.unmount();

    expect(importedPhotoIds(dependencies)).toHaveLength(1);
  });

  it('removes the file of a new photo as soon as it is removed from the form', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a']);
    await renderWithProviders(setup().element, { dependencies });
    await user.press(screen.getByRole('button', { name: 'Galería' }));
    await screen.findByText('1 de 6');

    await user.press(screen.getByRole('button', { name: 'Foto 1 de 1, portada' }));
    await user.press(screen.getByRole('button', { name: 'Quitar foto' }));
    await user.press(await screen.findByRole('button', { name: 'Quitar foto' }));

    await waitFor(() => {
      expect(importedPhotoIds(dependencies)).toHaveLength(0);
    });
    expect(await screen.findByText('0 de 6')).toBeOnTheScreen();
  });

  it('waits for an import that is still running before discarding on unmount', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a']);
    const original = dependencies.photos.importFromPicker.bind(dependencies.photos);
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    jest.spyOn(dependencies.photos, 'importFromPicker').mockImplementation(async (uri, id) => {
      await gate;
      return original(uri, id);
    });
    const view = await renderWithProviders(setup().element, { dependencies });
    await user.press(screen.getByRole('button', { name: 'Galería' }));
    await screen.findByLabelText('Preparando 1 foto');

    await view.unmount();
    finish();

    await waitFor(() => {
      expect(importedPhotoIds(dependencies)).toHaveLength(0);
    });
  });

  it('does not discard the files on unmount while a save is in flight', async () => {
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a']);
    let finishSave: () => void = () => undefined;
    const { element } = setup({
      onSubmit: () =>
        new Promise((resolve) => {
          finishSave = () => {
            resolve(ok(PRODUCT_ID));
          };
        }),
    });
    const view = await renderWithProviders(element, { dependencies });
    await fillRequired();
    await user.press(screen.getByRole('button', { name: 'Galería' }));
    await screen.findByText('1 de 6');
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    await view.unmount();
    finishSave();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(importedPhotoIds(dependencies)).toHaveLength(1);
  });

  it('waits for the photos that are being prepared and then saves everything', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockReturnValue();
    const dependencies = createTestDependencies();
    dependencies.photoPicker.willPick(['a']);
    const original = dependencies.photos.importFromPicker.bind(dependencies.photos);
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    jest.spyOn(dependencies.photos, 'importFromPicker').mockImplementation(async (uri, id) => {
      await gate;
      return original(uri, id);
    });
    const { element, onSubmit, onSaved } = setup();
    await renderWithProviders(element, { dependencies });
    await fillRequired();
    await user.press(screen.getByRole('button', { name: 'Galería' }));
    await screen.findByLabelText('Preparando 1 foto');

    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('button', { name: 'Preparando fotos…' })).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Esperando que terminen las fotos');
    expect(onSubmit).not.toHaveBeenCalled();
    finish();
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(PRODUCT_ID);
    });
    const [saved] = importedPhotoIds(dependencies);
    expect(onSubmit.mock.calls[0]?.[0].photos.map((photo) => photo.id)).toEqual([saved]);
    expect(screen.queryByRole('button', { name: 'Preparando fotos…' })).not.toBeOnTheScreen();
  });
});
