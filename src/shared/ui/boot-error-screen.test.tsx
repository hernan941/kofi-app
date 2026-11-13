import { screen, userEvent } from '@testing-library/react-native';

import { BootErrorScreen } from './boot-error-screen';
import { renderUi } from './testing/render-ui';

const user = userEvent.setup();

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

  it('offers only the emergency copy once it is connected', async () => {
    const onEmergencyExport = jest.fn();
    await renderUi(
      <BootErrorScreen reason="migration_failed" onEmergencyExport={onEmergencyExport} />,
    );

    await user.press(screen.getByRole('button', { name: 'Guardar una copia de mis datos' }));

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(onEmergencyExport).toHaveBeenCalledTimes(1);
  });
});
