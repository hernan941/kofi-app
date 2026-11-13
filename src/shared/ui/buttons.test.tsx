import { screen, userEvent } from '@testing-library/react-native';
import { createRef } from 'react';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';

import type { ButtonHandle } from './button-base';
import { DeleteButton } from './delete-button';
import { IconButton } from './icon-button';
import { PrimaryButton } from './primary-button';
import { SecondaryButton } from './secondary-button';
import { renderUi } from './testing/render-ui';
import { TextButton } from './text-button';

const user = userEvent.setup();

describe('PrimaryButton', () => {
  it('is a button named by its label that calls onPress', async () => {
    const onPress = jest.fn();
    await renderUi(<PrimaryButton label="Registrar venta" onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: 'Registrar venta' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('cannot be disabled', async () => {
    await renderUi(
      <PrimaryButton
        label="Guardar"
        onPress={jest.fn()}
        // @ts-expect-error The primary button never accepts a disabled state.
        isDisabled
      />,
    );

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });
});

describe('SecondaryButton and TextButton', () => {
  it('call onPress when enabled', async () => {
    const onSecondary = jest.fn();
    const onText = jest.fn();
    await renderUi(
      <>
        <SecondaryButton label="Esta semana no vendí" onPress={onSecondary} />
        <TextButton label="Ver todas" onPress={onText} />
      </>,
    );

    await user.press(screen.getByRole('button', { name: 'Esta semana no vendí' }));
    await user.press(screen.getByRole('button', { name: 'Ver todas' }));

    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it('expose the disabled state and ignore presses', async () => {
    const onPress = jest.fn();
    await renderUi(<SecondaryButton label="Reintentar" onPress={onPress} isDisabled />);

    const button = screen.getByRole('button', { name: 'Reintentar' });
    await user.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TextButton ref', () => {
  it('exposes the native button through ref', async () => {
    const ref = createRef<ButtonHandle>();
    await renderUi(<TextButton ref={ref} label="Agregar otra opción" onPress={jest.fn()} />);

    expect(ref.current).not.toBeNull();
  });
});

describe('PrimaryButton ref', () => {
  it('exposes the native button through ref', async () => {
    const ref = createRef<ButtonHandle>();
    await renderUi(<PrimaryButton ref={ref} label="Listo" onPress={jest.fn()} />);

    expect(ref.current).not.toBeNull();
  });
});

describe('DeleteButton', () => {
  it('says "Borrar" by default and shows the trash icon', async () => {
    const onPress = jest.fn();
    await renderUi(<DeleteButton onPress={onPress} />);

    await user.press(screen.getByRole('button', { name: 'Borrar' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('phosphor-react-native-trash-bold', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });
});

describe('IconButton', () => {
  it('is named by its required label', async () => {
    const onPress = jest.fn();
    await renderUi(
      <IconButton icon={PencilSimpleIcon} accessibilityLabel="Editar producto" onPress={onPress} />,
    );

    await user.press(screen.getByRole('button', { name: 'Editar producto' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('requires a label by type', async () => {
    await renderUi(
      // @ts-expect-error An icon-only button without a label is a type error.
      <IconButton icon={PencilSimpleIcon} onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button')).toBeOnTheScreen();
  });
});
