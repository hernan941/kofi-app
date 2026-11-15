import { zodResolver } from '@hookform/resolvers/zod';
import { screen, userEvent } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { AccessibilityInfo } from 'react-native';
import { z } from 'zod';

import { requiredTextSchema, type Clp } from '@/shared/domain';

import { PrimaryButton } from '../primary-button';
import { renderUi } from '../testing/render-ui';
import { clpTextSchema } from './clp-text-schema';
import { createSubmitHandler } from './create-submit-handler';
import { FormAmountField } from './form-amount-field';
import { FormTextField } from './form-text-field';

const user = userEvent.setup();

const productSchema = z.object({ name: requiredTextSchema(80), price: clpTextSchema });

/** Props of the probe form. */
interface ProductFormProps {
  readonly onSave: (values: { name: string; price: Clp }) => void;
}

function ProductForm({ onSave }: ProductFormProps) {
  const form = useForm<z.input<typeof productSchema>, unknown, z.output<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', price: '' },
  });
  return (
    <>
      <FormTextField control={form.control} name="name" label="Nombre" />
      <FormAmountField control={form.control} name="price" label="Precio" />
      <PrimaryButton label="Guardar" onPress={createSubmitHandler(form.handleSubmit, onSave)} />
    </>
  );
}

describe('form fields with the primary button', () => {
  it('keeps the button active with invalid data, shows the errors and tells the user', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const onSave = jest.fn();
    await renderUi(<ProductForm onSave={onSave} />);

    const button = screen.getByRole('button', { name: 'Guardar' });
    await user.press(button);

    expect(await screen.findByText('Completa este campo')).toBeOnTheScreen();
    expect(screen.getByText('Escribe un monto, por ejemplo 15.000')).toBeOnTheScreen();
    expect(screen.getByLabelText('Precio')).toHaveProp(
      'accessibilityHint',
      'Escribe un monto, por ejemplo 15.000',
    );
    expect(button).toBeEnabled();
    expect(spy).toHaveBeenCalledWith('Revisa los campos marcados');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('announces once on submit: the summary, not one message per field', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderUi(<ProductForm onSave={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Completa este campo');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Revisa los campos marcados');
  });

  it('still announces the error of a field that changes after the submit', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderUi(<ProductForm onSave={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Completa este campo');
    spy.mockClear();

    await user.type(screen.getByLabelText('Precio'), '1,5');

    expect(spy).toHaveBeenCalled();
  });

  it('explains amounts written with a comma', async () => {
    await renderUi(<ProductForm onSave={jest.fn()} />);

    await user.type(screen.getByLabelText('Precio'), '15,5');
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Escribe el monto sin comas')).toBeOnTheScreen();
  });

  it('sends the parsed values when the data is valid', async () => {
    const onSave = jest.fn();
    await renderUi(<ProductForm onSave={onSave} />);

    await user.type(screen.getByLabelText('Nombre'), 'Lámina Colibrí');
    await user.type(screen.getByLabelText('Precio'), '15000');
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByLabelText('Precio')).toHaveDisplayValue('15.000');
    await screen.findByRole('button', { name: 'Guardar' });
    expect(onSave).toHaveBeenCalledWith({ name: 'Lámina Colibrí', price: 15000 }, undefined);
  });
});
