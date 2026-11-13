import { screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { renderUi } from './testing/render-ui';
import { TextField } from './text-field';

const user = userEvent.setup();

/** Props of the controlled probe field. */
interface ControlledTextFieldProps {
  readonly label: string;
}

function ControlledTextField({ label }: ControlledTextFieldProps) {
  const [value, setValue] = useState('');
  return <TextField label={label} value={value} onChangeText={setValue} />;
}

describe('TextField', () => {
  it('is named by its visible label and shows what is typed', async () => {
    await renderUi(<ControlledTextField label="Nombre" />);

    await user.type(screen.getByLabelText('Nombre'), 'Lámina Colibrí');

    expect(screen.getByText('Nombre', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Nombre')).toHaveDisplayValue('Lámina Colibrí');
  });

  it('says "(opcional)" in the label of optional fields', async () => {
    await renderUi(<TextField label="Nota" isOptional value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText('Nota (opcional)')).toBeOnTheScreen();
  });

  it('shows the error with the icon and the text and ties it to the field', async () => {
    const message = 'Escribe un precio, por ejemplo 15.000';
    await renderUi(<TextField label="Precio" value="" onChangeText={jest.fn()} error={message} />);

    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(
      screen.getByTestId('phosphor-react-native-warning-circle-bold', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
    expect(screen.getByHintText(message)).toBe(screen.getByLabelText('Precio'));
  });

  it('announces the error when it appears', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { rerender } = await renderUi(
      <TextField label="Precio" value="" onChangeText={jest.fn()} />,
    );

    await rerender(
      <TextField label="Precio" value="" onChangeText={jest.fn()} error="Escribe un precio" />,
    );

    expect(spy).toHaveBeenCalledWith('Escribe un precio');
  });

  it('shows the help text below and uses it as the hint while there is no error', async () => {
    await renderUi(
      <TextField
        label="Costo"
        helper="Lo que te costó hacerlo"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    expect(screen.getByText('Lo que te costó hacerlo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Costo')).toHaveProp(
      'accessibilityHint',
      'Lo que te costó hacerlo',
    );
  });
});
