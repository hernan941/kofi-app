import { screen, userEvent } from '@testing-library/react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import { PermissionStatus } from './permission-status';

const user = userEvent.setup();

function setup(permission: Parameters<typeof PermissionStatus>[0]['permission']) {
  const onRequest = jest.fn();
  const onOpenSettings = jest.fn();
  return {
    onRequest,
    onOpenSettings,
    ready: renderUi(
      <PermissionStatus
        permission={permission}
        onRequest={onRequest}
        onOpenSettings={onOpenSettings}
      />,
    ),
  };
}

describe('PermissionStatus', () => {
  it('shows nothing while the permission is being read', async () => {
    const { ready } = setup(undefined);
    const view = await ready;

    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
    expect(screen.queryByText(/avisos/)).not.toBeOnTheScreen();
    expect(view.toJSON()).toBeDefined();
  });

  it('invites to activate the notices when the permission is undecided', async () => {
    const { ready, onRequest, onOpenSettings } = setup('undetermined');
    await ready;

    expect(screen.getByText('Activa los avisos')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Para que te lleguen los recordatorios, cuantovendi necesita tu permiso para enviarte avisos.',
      ),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Activar recordatorios' }));

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  it('leads to the system settings, without asking again, when the permission is denied', async () => {
    const { ready, onRequest, onOpenSettings } = setup('denied');
    await ready;

    expect(screen.getByText('Los avisos están apagados')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Están desactivados en los ajustes de tu teléfono. Si quieres recibirlos, actívalos ahí.',
      ),
    ).toBeOnTheScreen();
    const button = screen.getByRole('button', { name: 'Abrir ajustes' });
    expect(button.props.accessibilityHint).toBe('Abre los ajustes de cuantovendi en tu teléfono');
    await user.press(button);

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onRequest).not.toHaveBeenCalled();
  });

  it('shows a quiet line, with no button, when the permission is granted', async () => {
    const { ready } = setup('granted');
    await ready;

    expect(screen.getByText('Los avisos están activados en tu teléfono.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).not.toBeOnTheScreen();
  });
});
