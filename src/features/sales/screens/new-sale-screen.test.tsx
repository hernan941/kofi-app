import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';
import { clearPerfMarks, readPerfMarks } from '@/shared/lib/perf-marks';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import {
  clp,
  date,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
} from '../domain/testing/sale-fixtures';
import { NewSaleScreen, type NewSaleScreenProps } from './new-sale-screen';

type PreventRemoveCallback = (options: { data: { action: unknown }; repeat: () => void }) => void;
const mockPrevent: { calls: [boolean, PreventRemoveCallback][] } = { calls: [] };
jest.mock('expo-router', () => ({
  usePreventRemove: (prevent: boolean, callback: PreventRemoveCallback) => {
    mockPrevent.calls.push([prevent, callback]);
  },
}));

const user = userEvent.setup();

const lamina = makeProduct(1, [makeVersion(1, { pricing: { mode: 'fixed', price: clp(15000) } })], {
  name: 'Lámina Colibrí',
});
const taza = makeProduct(2, [makeVersion(2, { productN: 2 })], { name: 'Taza' });

function setup(products = [lamina, taza], props: Partial<NewSaleScreenProps> = {}) {
  const dependencies: TestDependencies = createTestDependencies();
  for (const product of products) dependencies.products.saveSync(product);
  const handlers = {
    onFinished: jest.fn(),
    onCreateProduct: jest.fn(),
    onCancel: jest.fn(),
  };
  const view = renderWithProviders(<NewSaleScreen {...handlers} {...props} />, {
    dependencies,
    observeDataChanges: true,
  });
  return { dependencies, handlers, view };
}

async function register(name: string) {
  await user.press(await screen.findByRole('button', { name }));
  await user.press(screen.getByRole('button', { name: 'Guardar venta' }));
}

describe('NewSaleScreen', () => {
  beforeEach(() => {
    mockPrevent.calls = [];
  });

  it('registers a sale in three presses and celebrates the first one', async () => {
    const { view } = setup();
    await view;

    await register('Lámina Colibrí, 15.000 pesos');

    expect(
      await screen.findByRole('header', { name: /^¡Registraste tu primera venta!/ }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: '¡Registraste tu primera venta! 15.000 pesos' }),
    ).toBeOnTheScreen();
  });

  it('celebrates the second sale with the regular title', async () => {
    const { dependencies, view } = setup();
    dependencies.sales.saveSync(makeSaleRecord([makeSaleItem(1)], { soldOn: date('2026-06-30') }));
    await view;

    await register('Lámina Colibrí, 15.000 pesos');

    expect(await screen.findByRole('header', { name: /^¡Venta registrada!/ })).toBeOnTheScreen();
  });

  it('saves the sale', async () => {
    const { dependencies, view } = setup();
    await view;

    await register('Taza, 1.000 pesos');
    await screen.findByRole('header', { name: /Registraste|registrada/ });

    const [record] = (await dependencies.sales.listRecent(10)).records;
    expect(record?.items.map((item) => item.productId)).toEqual([taza.id]);
  });

  it('reports the outcome when "Listo" is pressed', async () => {
    const { handlers, view } = setup();
    await view;
    await register('Lámina Colibrí, 15.000 pesos');

    await user.press(await screen.findByRole('button', { name: 'Listo' }));

    await waitFor(() => {
      expect(handlers.onFinished).toHaveBeenCalledTimes(1);
    });
    expect(handlers.onFinished).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'created', isFirstSale: true }),
    );
  });

  it('finishes like "Listo" when the person goes back during the celebration', async () => {
    const { handlers, view } = setup();
    await view;
    await register('Lámina Colibrí, 15.000 pesos');
    await screen.findByRole('header', { name: /^¡Registraste tu primera venta!/ });

    const [isBlocked, callback] = mockPrevent.calls.at(-1) ?? [false, () => undefined];
    expect(isBlocked).toBe(true);
    await act(() => {
      callback({ data: { action: {} }, repeat: jest.fn() });
    });

    await waitFor(() => {
      expect(handlers.onFinished).toHaveBeenCalledTimes(1);
    });
  });

  it('lets the route put something in the reserved spot of the celebration', async () => {
    const { view } = setup([lamina, taza], {
      renderAfterSave: (outcome) => <Text>{`Consejo ${outcome.kind}`}</Text>,
    });
    await view;

    await register('Lámina Colibrí, 15.000 pesos');

    expect(await screen.findByText('Consejo created')).toBeOnTheScreen();
  });

  it('marks "esta semana no vendí" and stays on the screen', async () => {
    const { handlers, view } = setup();
    await view;

    await user.press(await screen.findByRole('button', { name: 'Esta semana no vendí' }));

    expect(await screen.findByText('Marcaste que esta semana no vendiste.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Registrar venta' })).toBeOnTheScreen();
    expect(handlers.onFinished).not.toHaveBeenCalled();
  });

  it('removes the mark and tells it when a sale is registered in a marked week', async () => {
    const { view } = setup();
    await view;
    await user.press(await screen.findByRole('button', { name: 'Esta semana no vendí' }));
    await screen.findByText('Marcaste que esta semana no vendiste.');

    await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));
    await user.press(screen.getByRole('button', { name: 'Guardar venta' }));

    expect(
      await screen.findByText('Como vendiste esta semana, quitamos la marca de "no vendí".'),
    ).toBeOnTheScreen();
  });

  it('invites to create a product when there are none, and keeps "no vendí" available', async () => {
    const { handlers, view } = setup([]);
    await view;

    expect(await screen.findByText('Primero, agrega lo que vendes')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Esta semana no vendí' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Agregar producto' }));

    expect(handlers.onCreateProduct).toHaveBeenCalledTimes(1);
  });

  it('shows the new product, already loaded, when it comes back from creating one', async () => {
    const { dependencies, view } = setup([]);
    await view;
    await screen.findByText('Primero, agrega lo que vendes');

    await act(async () => {
      dependencies.products.saveSync(lamina);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByLabelText('Total: 15.000 pesos')).toBeOnTheScreen();
  });

  it('offers a retry when the products cannot be read', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.products, 'listActive').mockRejectedValueOnce(new Error('boom'));
    await renderWithProviders(
      <NewSaleScreen onFinished={jest.fn()} onCreateProduct={jest.fn()} onCancel={jest.fn()} />,
      { dependencies },
    );

    expect(
      await screen.findByText('No se pudieron cargar tus productos. Inténtalo de nuevo.'),
    ).toBeOnTheScreen();
  });

  it('says calmly that the sale could not be saved and keeps what was chosen', async () => {
    const { dependencies, view } = setup([lamina, taza]);
    jest.spyOn(dependencies.saleWriter, 'saveSync').mockImplementation(() => {
      throw new Error('disk full');
    });
    await view;

    await register('Lámina Colibrí, 15.000 pesos');

    expect(
      (
        await screen.findAllByText('No se pudo guardar la venta. Inténtalo de nuevo.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText('Total: 15.000 pesos')).toBeOnTheScreen();
    expect(findGuiltPattern('No se pudo guardar la venta. Inténtalo de nuevo.')).toBeNull();
  });
});

describe('NewSaleScreen performance marks (P2)', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_E2E;
    clearPerfMarks();
  });

  it('marks the form ready, the press on save and the visible celebration, in order', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const { view } = setup();
    await view;

    await register('Lámina Colibrí, 15.000 pesos');
    await screen.findByRole('header', { name: /^¡Registraste tu primera venta!/ });

    expect(readPerfMarks().map(({ name }) => name)).toEqual([
      'sale-form:ready',
      'sale:save:press',
      'sale:celebration:visible',
    ]);
  });
});
