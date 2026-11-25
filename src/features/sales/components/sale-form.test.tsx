import { fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { seedNoSalesWeek } from '@/core/testing/sales-test-data';
import { err, ok, saleRecordIdSchema, type Result } from '@/shared/domain';

import type { Product } from '@/features/products/domain';
import type { SaleErrors } from '../domain';
import {
  clp,
  date,
  fixtureId,
  makeProduct,
  makeSaleItem,
  makeSaleRecord,
  makeVersion,
} from '../domain/testing/sale-fixtures';
import type { SaveSaleRecordResult } from '../use-cases/save-sale-record';
import { SaleForm, type SaleFormProps } from './sale-form';
import { toSaleFormValues } from './sale-form-schema';

/** Dispara un evento y espera a que React termine de aplicarlo (en RNTL 14 `fireEvent` devuelve una promesa). */
async function settle(pending: Promise<unknown>) {
  await pending;
}

jest.mock('expo-router', () => ({ usePreventRemove: jest.fn() }));

const user = userEvent.setup();

const TODAY = date('2026-07-01');

const lamina = makeProduct(1, [makeVersion(1, { pricing: { mode: 'fixed', price: clp(15000) } })], {
  name: 'Lámina Colibrí',
});
const taza = makeProduct(2, [makeVersion(2, { productN: 2 })], { name: 'Taza' });
const retrato = makeProduct(3, [makeVersion(3, { productN: 3, pricing: { mode: 'negotiable' } })], {
  name: 'Retrato',
});
const print = makeProduct(
  4,
  [
    makeVersion(4, {
      productN: 4,
      name: 'Print A4',
      pricing: { mode: 'fixed', price: clp(10000) },
    }),
    makeVersion(5, {
      productN: 4,
      name: 'Print A3',
      pricing: { mode: 'fixed', price: clp(18000) },
    }),
  ],
  { name: 'Print' },
);

const savedValue: SaveSaleRecordResult = {
  kind: 'saved',
  outcome: {
    kind: 'created',
    recordId: saleRecordIdSchema.parse(fixtureId(4, 1)),
    soldOn: TODAY,
    isFirstSale: false,
    clearedNoSalesWeek: null,
  },
};
const savedResult: Result<SaveSaleRecordResult, SaleErrors> = ok(savedValue);

function renderForm(overrides: Partial<SaleFormProps> = {}, sellable: Product[] = [lamina, taza]) {
  const dependencies = createTestDependencies();
  const props: SaleFormProps = {
    mode: 'create',
    initialValues: toSaleFormValues(null, TODAY, sellable),
    sellable,
    catalog: new Map(sellable.map((product) => [product.id, product])),
    onSubmit: jest.fn().mockResolvedValue(savedResult),
    onSaved: jest.fn(),
    onUnmappedErrors: jest.fn(),
    ...overrides,
  };
  const view = renderWithProviders(<SaleForm {...props} />, {
    dependencies,
    observeDataChanges: true,
  });
  return { props, dependencies, view };
}

describe('SaleForm', () => {
  describe('layout', () => {
    it('is drawn inside the form layout with the total and the save button in the fixed footer', async () => {
      await renderForm().view;
      await user.press(screen.getByRole('button', { name: 'Taza, 1.000 pesos' }));

      const footer = within(screen.getByTestId('form-layout-footer'));
      expect(screen.getByTestId('form-layout')).toBeOnTheScreen();
      expect(footer.getByLabelText(/^Total:/)).toBeOnTheScreen();
      expect(footer.getByRole('button', { name: 'Guardar venta' })).toBeOnTheScreen();
    });
  });

  describe('date', () => {
    it('starts today, with the list of products in view and no way to pick tomorrow', async () => {
      await renderForm().view;

      expect(
        screen.getByLabelText('¿Cuándo vendiste?: Hoy, miércoles 1 de julio'),
      ).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Día siguiente' })).toBeDisabled();
      expect(screen.getByRole('header', { name: '¿Qué vendiste?' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Taza, 1.000 pesos' })).toBeOnTheScreen();
    });

    it('moves to yesterday', async () => {
      await renderForm().view;

      await user.press(screen.getByRole('button', { name: 'Día anterior' }));

      expect(
        screen.getByLabelText('¿Cuándo vendiste?: Ayer, martes 30 de junio'),
      ).toBeOnTheScreen();
    });

    it('chooses another date from the calendar, which has no days after today', async () => {
      await renderForm().view;

      await user.press(screen.getByRole('button', { name: 'Elegir otra fecha' }));
      expect(screen.getByRole('button', { name: 'Jueves 2 de julio' })).toBeDisabled();
      await user.press(screen.getByRole('button', { name: 'Mes anterior' }));
      await user.press(screen.getByRole('button', { name: 'Lunes 22 de junio' }));

      expect(screen.getByLabelText('¿Cuándo vendiste?: Lunes 22 de junio')).toBeOnTheScreen();
    });

    it('warns calmly that the mark of "no vendí" is removed when saving in a marked week', async () => {
      const { dependencies, view } = renderForm();
      seedNoSalesWeek(dependencies, '2026-06-29');
      await view;

      expect(
        await screen.findByText(
          'Marcaste esa semana como "no vendí". Si guardas esta venta, esa marca se quita.',
        ),
      ).toBeOnTheScreen();
    });
  });

  describe('choosing products', () => {
    it('adds a product with one version, folds the list and shows the total', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      await renderForm().view;

      await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));

      expect(screen.queryByRole('button', { name: 'Taza, 1.000 pesos' })).not.toBeOnTheScreen();
      expect(screen.getByLabelText('Precio de cada uno de Lámina Colibrí')).toHaveDisplayValue(
        '15.000',
      );
      expect(screen.getByLabelText('Total: 15.000 pesos')).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith('Agregaste Lámina Colibrí.');
      expect(screen.queryByRole('button', { name: /^Cambiar/ })).not.toBeOnTheScreen();
    });

    it('is already loaded when there is a single product with a single version', async () => {
      await renderForm({}, [lamina]).view;

      expect(screen.getByLabelText('Precio de cada uno de Lámina Colibrí')).toHaveDisplayValue(
        '15.000',
      );
      expect(screen.getByLabelText('Total: 15.000 pesos')).toBeOnTheScreen();
    });

    it('asks for the version of a product that has several and then adds it', async () => {
      await renderForm({}, [print, taza]).view;

      await user.press(screen.getByRole('button', { name: /Print, 2 versiones/ }));
      expect(screen.getByRole('header', { name: '¿Qué versión de Print?' })).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Print A3, 18.000 pesos' }));

      expect(screen.getByText('Print A3')).toBeOnTheScreen();
      expect(screen.getByLabelText('Precio de cada uno de Print')).toHaveDisplayValue('18.000');
      expect(screen.getByLabelText('Total: 18.000 pesos')).toBeOnTheScreen();
    });

    it('changes the version of a row with "Cambiar", changing its price', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      await renderForm({}, [print, taza]).view;
      await user.press(screen.getByRole('button', { name: /Print, 2 versiones/ }));
      await user.press(screen.getByRole('button', { name: 'Print A3, 18.000 pesos' }));

      await user.press(screen.getByRole('button', { name: 'Cambiar versión de Print' }));
      await user.press(screen.getByRole('button', { name: 'Print A4, 10.000 pesos' }));

      expect(screen.getByLabelText('Precio de cada uno de Print')).toHaveDisplayValue('10.000');
      expect(announce).toHaveBeenCalledWith('Ahora es Print A4.');
    });

    it('leaves the price of a "a convenir" product empty with a hint and asks for it on save', async () => {
      const { props, view } = renderForm({}, [retrato, taza]);
      await view;

      await user.press(screen.getByRole('button', { name: 'Retrato, precio a convenir' }));
      expect(screen.getByLabelText('Precio de cada uno de Retrato')).toHaveDisplayValue('');
      expect(screen.getByText('Escribe a cuánto lo vendiste.')).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Guardar venta' }));

      expect(
        await screen.findByText('Escribe a cuánto lo vendiste, por ejemplo 15.000'),
      ).toBeOnTheScreen();
      expect(props.onSubmit).not.toHaveBeenCalled();
    });

    it('keeps two rows when the same product is added twice', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      await renderForm().view;
      await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));

      await user.press(screen.getByRole('button', { name: 'Agregar otro producto' }));
      await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));

      expect(screen.getAllByLabelText('Precio de cada uno de Lámina Colibrí')).toHaveLength(2);
      expect(announce).toHaveBeenCalledWith('Agregaste Lámina Colibrí de nuevo.');
      expect(screen.getByLabelText('Total: 30.000 pesos')).toBeOnTheScreen();
    });

    it('removes a row without asking and brings the list back', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      await renderForm().view;
      await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));

      await user.press(screen.getByRole('button', { name: 'Quitar Lámina Colibrí' }));

      expect(announce).toHaveBeenCalledWith('Quitaste Lámina Colibrí.');
      expect(screen.getByRole('button', { name: 'Taza, 1.000 pesos' })).toBeOnTheScreen();
      expect(screen.queryByLabelText(/^Total:/)).not.toBeOnTheScreen();
    });

    it('replaces "Agregar otro producto" with a notice at 100 rows', async () => {
      const initialValues = toSaleFormValues(null, TODAY, [lamina]);
      await renderForm({
        initialValues: {
          ...initialValues,
          items: initialValues.items.flatMap((row) =>
            Array.from({ length: 100 }, () => ({ ...row })),
          ),
        },
      }).view;

      expect(
        screen.getByText(
          'Llegaste a 100 productos en esta venta. Guárdala y registra el resto en otra.',
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Agregar otro producto' })).not.toBeOnTheScreen();
    });
  });

  describe('what the screen reader says for each row', () => {
    it('names the controls of each product, so two rows are never ambiguous', async () => {
      await renderForm({}, [lamina, taza]).view;
      await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));
      await user.press(screen.getByRole('button', { name: 'Agregar otro producto' }));
      await user.press(screen.getByRole('button', { name: /^Taza/ }));

      for (const name of ['Lámina Colibrí', 'Taza']) {
        expect(screen.getByRole('button', { name: `Quitar ${name}` })).toBeOnTheScreen();
        expect(screen.getByLabelText(`Precio de cada uno de ${name}`)).toBeOnTheScreen();
        expect(
          screen.getByRole('button', { name: `Quitar uno a la cantidad de ${name}` }),
        ).toBeOnTheScreen();
        expect(
          screen.getByRole('button', { name: `Agregar uno a la cantidad de ${name}` }),
        ).toBeOnTheScreen();
      }
    });

    it('reads the total and the subtotal as one stop each, without a second stop for the amount', async () => {
      await renderForm({}, [lamina]).view;
      await user.press(
        screen.getByRole('button', { name: 'Agregar uno a la cantidad de Lámina Colibrí' }),
      );

      expect(screen.getByLabelText('Total: 30.000 pesos')).toBeOnTheScreen();
      expect(screen.getByLabelText('Subtotal: 30.000 pesos')).toBeOnTheScreen();
      expect(screen.queryByLabelText('30.000 pesos')).not.toBeOnTheScreen();
    });

    it('moves the focus to the add button before announcing the added product', async () => {
      const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
      await renderForm().view;

      await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));

      await waitFor(() => {
        expect(focus.mock.calls.some(([, event]) => event === 'focus')).toBe(true);
      });
    });
  });

  describe('quantity and price', () => {
    it('recalculates the total when the quantity or the price change', async () => {
      await renderForm({}, [lamina]).view;

      await user.press(
        screen.getByRole('button', { name: 'Agregar uno a la cantidad de Lámina Colibrí' }),
      );
      expect(screen.getByLabelText('Total: 30.000 pesos')).toBeOnTheScreen();
      expect(screen.getByLabelText('Subtotal: 30.000 pesos')).toBeOnTheScreen();

      const price = screen.getByLabelText('Precio de cada uno de Lámina Colibrí');
      await user.clear(price);
      await user.type(price, '1500');
      const quantity = screen.getByRole('adjustable', { name: 'Cantidad de Lámina Colibrí' });
      await settle(fireEvent.changeText(quantity, ''));
      await user.type(quantity, '40');

      expect(screen.getByLabelText('Total: 60.000 pesos')).toBeOnTheScreen();
    });
  });

  describe('more details', () => {
    it('is closed until pressed, then shows the five channels and the note', async () => {
      await renderForm({}, [lamina]).view;
      expect(screen.queryByText('Feria')).not.toBeOnTheScreen();
      const toggle = screen.getByRole('button', { name: 'Más detalles' });
      expect(toggle).toHaveProp('accessibilityHint', 'Dónde vendiste y una nota');

      await user.press(toggle);

      for (const label of ['Feria', 'Redes sociales', 'Tienda o consignación', 'Encargo', 'Otro']) {
        expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
      }
      expect(screen.getByLabelText('Nota (opcional)')).toBeOnTheScreen();
    });

    it('says whether the details are collapsed or expanded', async () => {
      await renderForm({}, [lamina]).view;

      const toggle = screen.getByRole('button', { name: 'Más detalles' });
      expect(toggle).toBeCollapsed();

      await user.press(toggle);

      expect(screen.getByRole('button', { name: /Más detalles/ })).toBeExpanded();
    });

    it('reaches the question of the optional channel as text', async () => {
      await renderForm({}, [lamina]).view;
      await user.press(screen.getByRole('button', { name: 'Más detalles' }));

      expect(screen.getByText('¿Dónde vendiste? (opcional)')).toBeOnTheScreen();
    });

    it('lets a channel be deselected and summarizes what is inside when closed', async () => {
      await renderForm({}, [lamina]).view;
      await user.press(screen.getByRole('button', { name: 'Más detalles' }));

      await user.press(screen.getByRole('button', { name: 'Feria' }));
      expect(screen.getByRole('button', { name: 'Feria' })).toBeSelected();
      await user.press(screen.getByRole('button', { name: 'Feria' }));
      expect(screen.getByRole('button', { name: 'Feria' })).not.toBeSelected();

      await user.press(screen.getByRole('button', { name: 'Feria' }));
      await user.type(screen.getByLabelText('Nota (opcional)'), 'Parque');
      await user.press(screen.getByRole('button', { name: /Más detalles/ }));

      expect(
        screen.getByRole('button', { name: 'Más detalles (Feria, con nota)' }),
      ).toBeOnTheScreen();
    });
  });

  describe('saving', () => {
    it('sends the domain input and reports the result', async () => {
      const { props, view } = renderForm({}, [lamina]);
      await view;

      await user.press(screen.getByRole('button', { name: 'Guardar venta' }));

      expect(props.onSubmit).toHaveBeenCalledWith({
        soldOn: TODAY,
        channel: null,
        note: null,
        items: [
          {
            itemId: null,
            productId: lamina.id,
            productVersionId: lamina.versions[0]?.id,
            quantity: 1,
            unitPrice: 15000,
          },
        ],
      });
      expect(props.onSaved).toHaveBeenCalledWith(
        savedValue,
        expect.objectContaining({ items: expect.any(Array) as unknown }),
      );
    });

    it('marks "Elige al menos un producto que vendiste" when nothing was chosen', async () => {
      const { props, view } = renderForm({
        onSubmit: jest.fn().mockResolvedValue(err([{ code: 'no_items', path: ['items'] }])),
      });
      await view;

      await user.press(screen.getByRole('button', { name: 'Guardar venta' }));

      expect(await screen.findByText('Elige al menos un producto que vendiste')).toBeOnTheScreen();
      expect(props.onSaved).not.toHaveBeenCalled();
    });

    it('ignores a second press while it is saving', async () => {
      let finish: (value: Result<SaveSaleRecordResult, SaleErrors>) => void = () => undefined;
      const onSubmit = jest.fn().mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      await renderForm({ onSubmit }, [lamina]).view;

      await user.press(screen.getByRole('button', { name: 'Guardar venta' }));
      await user.press(screen.getByRole('button', { name: 'Guardar venta' }));
      finish(savedResult);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('hands errors without a field to the screen', async () => {
      const errors: SaleErrors = [{ code: 'item_not_found', path: ['items', 0, 'itemId'] }];
      const { props, view } = renderForm({ onSubmit: jest.fn().mockResolvedValue(err(errors)) }, [
        lamina,
      ]);
      await view;

      await user.press(screen.getByRole('button', { name: 'Guardar venta' }));

      expect(props.onUnmappedErrors).toHaveBeenCalledWith(errors, expect.any(Function));
    });
  });

  describe('"no vendí"', () => {
    it('is offered while nothing was chosen and goes away when a product is added', async () => {
      await renderForm().view;
      expect(await screen.findByRole('button', { name: 'Esta semana no vendí' })).toBeOnTheScreen();

      await user.press(screen.getByRole('button', { name: 'Lámina Colibrí, 15.000 pesos' }));

      expect(screen.queryByRole('button', { name: 'Esta semana no vendí' })).not.toBeOnTheScreen();
    });
  });

  describe('editing', () => {
    const record = makeSaleRecord([makeSaleItem(1, { quantity: 2 })], {
      soldOn: date('2026-06-30'),
      channel: 'fair',
      note: 'Parque',
    });
    const editProps = (): Partial<SaleFormProps> => ({
      mode: 'edit',
      initialValues: toSaleFormValues(record, TODAY, [lamina], new Map([[lamina.id, lamina]])),
    });

    it('opens the details when there is a channel or a note, without the "no vendí" panel', async () => {
      await renderForm(editProps(), [lamina]).view;

      expect(screen.getByRole('button', { name: 'Feria' })).toBeSelected();
      expect(screen.getByLabelText('Nota (opcional)')).toHaveDisplayValue('Parque');
      expect(screen.queryByRole('button', { name: 'Esta semana no vendí' })).not.toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeOnTheScreen();
    });

    it('asks before removing the last product, and removing confirms an empty edit', async () => {
      const { props, view } = renderForm(editProps(), [lamina]);
      await view;

      await user.press(screen.getByRole('button', { name: 'Quitar Lámina Colibrí' }));
      expect(
        screen.getByText('Si quitas el último producto, la venta se borra. No se puede deshacer.'),
      ).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByLabelText('Precio de cada uno de Lámina Colibrí')).toBeOnTheScreen();

      await user.press(screen.getByRole('button', { name: 'Quitar Lámina Colibrí' }));
      await user.press(screen.getAllByRole('button', { name: 'Borrar venta' }).at(-1) as never);

      expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ items: [] }));
    });

    it('marks an archived product and offers no version change', async () => {
      const archived = makeProduct(1, lamina.versions, {
        name: 'Lámina Colibrí',
        archivedAt: 1 as never,
      });
      await renderForm(
        {
          mode: 'edit',
          initialValues: toSaleFormValues(record, TODAY, [], new Map([[archived.id, archived]])),
          catalog: new Map([[archived.id, archived]]),
        },
        [],
      ).view;

      expect(screen.getByText('Archivado')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /^Cambiar/ })).not.toBeOnTheScreen();
      expect(screen.getByLabelText('Precio de cada uno de Lámina Colibrí')).toBeOnTheScreen();
    });
  });
});
