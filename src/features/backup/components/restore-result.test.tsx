import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { RestoreFailure, RestoreSuccess } from './restore-result';

const user = userEvent.setup();
const DATE = { text: '13 de noviembre de 2026, 15:42', isRelative: false } as const;

describe('RestoreSuccess', () => {
  it('celebrates quietly and says what the app has now', async () => {
    await renderUi(<RestoreSuccess source="file" date={DATE} onGoHome={jest.fn()} />);

    expect(
      screen.getByRole('header', { name: 'Listo, restauramos tu respaldo' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Ahora la app tiene los productos y las ventas del respaldo del 13 de noviembre de 2026, 15:42.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Cómo estaba la app antes quedó guardado en "Copia de seguridad", en esta misma pantalla.',
      ),
    ).toBeOnTheScreen();
  });

  it('uses the texts of the safety copy', async () => {
    await renderUi(
      <RestoreSuccess
        source="safety"
        date={{ text: 'hoy, 15:42', isRelative: true }}
        onGoHome={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('header', { name: 'Listo, volviste a la copia de seguridad' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Ahora la app tiene los productos y las ventas de la copia de hoy, 15:42.'),
    ).toBeOnTheScreen();
  });

  it('announces the result and goes home', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const onGoHome = jest.fn();
    await renderUi(<RestoreSuccess source="file" date={DATE} onGoHome={onGoHome} />);

    await user.press(screen.getByRole('button', { name: 'Ir al inicio' }));

    expect(announce).toHaveBeenCalledWith('Restauramos tu respaldo.');
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});

describe('RestoreFailure', () => {
  it('shows the title and the sentence of the problem and goes back', async () => {
    const onBack = jest.fn();
    await renderUi(
      <RestoreFailure
        problem={{ code: 'not_a_backup' }}
        source="file"
        afterConfirm={false}
        onBack={onBack}
        onPickAnother={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('header', { name: 'Este archivo no es un respaldo de Kofi' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Tus datos siguen como estaban.')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('announces the title of the problem', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderUi(
      <RestoreFailure
        problem="unexpected"
        source="file"
        afterConfirm={false}
        onBack={jest.fn()}
        onPickAnother={jest.fn()}
      />,
    );

    expect(announce).toHaveBeenCalledWith('No pudimos terminar');
  });

  it('offers another file when the problem is the file and says the data stay after confirming', async () => {
    const onPickAnother = jest.fn();
    await renderUi(
      <RestoreFailure
        problem={{ code: 'checksum_mismatch', path: 'data.json' }}
        source="file"
        afterConfirm
        onBack={jest.fn()}
        onPickAnother={onPickAnother}
      />,
    );

    expect(screen.getByText('Tus datos siguen como estaban.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Elegir otro archivo' }));

    expect(onPickAnother).toHaveBeenCalledTimes(1);
  });

  it('does not offer another file for a problem that is not the file', async () => {
    await renderUi(
      <RestoreFailure
        problem={{ code: 'not_enough_space', requiredBytes: 350_000_000 }}
        source="file"
        afterConfirm={false}
        onBack={jest.fn()}
        onPickAnother={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Elegir otro archivo' })).not.toBeOnTheScreen();
    expect(screen.getByText(/350 MB/)).toBeOnTheScreen();
  });

  it('never offers another file for the safety copy', async () => {
    await renderUi(
      <RestoreFailure
        problem={{ code: 'entries_mismatch' }}
        source="safety"
        afterConfirm={false}
        onBack={jest.fn()}
        onPickAnother={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Elegir otro archivo' })).not.toBeOnTheScreen();
  });
});
