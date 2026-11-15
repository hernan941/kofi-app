import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { BootErrorScreen } from './boot-error-screen';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

let announceSpy: jest.SpyInstance<void, [string]>;

beforeEach(() => {
  announceSpy = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined);
});

describe('BootErrorScreen', () => {
  it.each(['migration_failed', 'foreign_key_violation'] as const)(
    'explains a %s without offering any write action',
    async (reason) => {
      await renderUi(<BootErrorScreen reason={reason} />);

      expect(screen.getByRole('header', { name: 'No pudimos abrir tus datos' })).toBeOnTheScreen();
      expect(screen.getByText(/Cierra la app y vuelve a abrirla/)).toBeOnTheScreen();
      expect(screen.getByText(/no desinstales la app/)).toBeOnTheScreen();
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    },
  );

  it('asks to update the app when the data is newer than the code', async () => {
    await renderUi(<BootErrorScreen reason="newer_database" />);

    expect(screen.getByRole('header', { name: 'Actualiza la app' })).toBeOnTheScreen();
    expect(
      screen.getByText('Necesitas una versión más nueva de la app para abrir tus datos.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/tienda/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });

  describe('emergency export', () => {
    const REASONS = ['migration_failed', 'foreign_key_violation', 'newer_database'] as const;

    it.each(REASONS)('offers the copy as the only action for a %s', async (reason) => {
      const onPress = jest.fn();
      await renderUi(
        <BootErrorScreen reason={reason} emergencyExport={{ status: { kind: 'idle' }, onPress }} />,
      );

      expect(
        screen.getByText(
          'Puedes guardar una copia de tus datos y fotos tal como están ahora, para tenerlos a salvo.',
        ),
      ).toBeOnTheScreen();
      expect(
        screen.getByHintText('Crea un archivo con tus datos para guardarlo fuera de la app'),
      ).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Guardar una copia de mis datos' }));

      expect(screen.getAllByRole('button')).toHaveLength(1);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('shows nothing under the button while idle', async () => {
      await renderUi(
        <BootErrorScreen
          reason="migration_failed"
          emergencyExport={{ status: { kind: 'idle' }, onPress: jest.fn() }}
        />,
      );

      expect(screen.queryByText('Preparando la copia…')).not.toBeOnTheScreen();
      expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
      expect(screen.queryByText(/Copia lista/)).not.toBeOnTheScreen();
    });

    it('disables the button and announces the progress while working', async () => {
      const onPress = jest.fn();
      await renderUi(
        <BootErrorScreen
          reason="migration_failed"
          emergencyExport={{ status: { kind: 'working' }, onPress }}
        />,
      );

      await user.press(screen.getByRole('button', { name: 'Guardar una copia de mis datos' }));

      expect(onPress).not.toHaveBeenCalled();
      expect(screen.getByRole('progressbar', { name: 'Preparando la copia…' })).toBeOnTheScreen();
      expect(screen.getByText('Preparando la copia…')).toBeOnTheScreen();
      expect(announceSpy).toHaveBeenCalledWith('Preparando la copia…');
    });

    it('confirms the copy is ready and says it cannot be restored from the app', async () => {
      await renderUi(
        <BootErrorScreen
          reason="migration_failed"
          emergencyExport={{ status: { kind: 'done' }, onPress: jest.fn() }}
        />,
      );

      expect(
        screen.getByText(
          'Copia lista. Guárdala en tu correo o en Drive. Esta copia sirve para rescatar tus datos, pero no se puede restaurar desde la app.',
        ),
      ).toBeOnTheScreen();
      expect(announceSpy).toHaveBeenCalledTimes(1);
    });

    it('shows the problem and lets the person try again', async () => {
      const onPress = jest.fn();
      await renderUi(
        <BootErrorScreen
          reason="migration_failed"
          emergencyExport={{
            status: {
              kind: 'failed',
              message: 'No pudimos crear la copia. Vuelve a intentarlo en un momento.',
            },
            onPress,
          }}
        />,
      );

      expect(
        screen.getByText('No pudimos crear la copia. Vuelve a intentarlo en un momento.'),
      ).toBeOnTheScreen();
      await user.press(screen.getByRole('button', { name: 'Guardar una copia de mis datos' }));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
