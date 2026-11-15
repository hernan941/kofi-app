import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Linking } from 'react-native';

import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { NotificationsHost } from '../components/notifications-host';
import type { NotificationPermission } from '../domain/ports';
import { NotificationSettingsScreen } from './notification-settings-screen';

/** Dispara un evento y espera a que React lo aplique (en RNTL 14 `fireEvent` devuelve una promesa). */
async function settle(pending: Promise<unknown>) {
  await pending;
}

const user = userEvent.setup();

function firstCloseButton() {
  const [button] = screen.getAllByRole('button', { name: 'Cerrar' });
  if (button === undefined) {
    throw new Error('The sheet has no close button.');
  }
  return button;
}

async function setup(
  permission: NotificationPermission,
  dependencies: TestDependencies = createTestDependencies(),
) {
  dependencies.notifications.setPermission(permission);
  const onBack = jest.fn();
  await renderWithProviders(
    <>
      <NotificationsHost navigationReady onOpen={jest.fn()} />
      <NotificationSettingsScreen onBack={onBack} />
    </>,
    { dependencies, observeDataChanges: true },
  );
  return { dependencies, onBack };
}

async function ready() {
  await screen.findByRole('switch', { name: 'Recordatorio semanal' });
}

describe('NotificationSettingsScreen', () => {
  it('shows the title, the switches and the day and time with the defaults', async () => {
    await setup('granted');
    await ready();

    expect(screen.getByRole('header', { name: 'Recordatorios' })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Recordatorio semanal' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Resumen del mes' })).toBeChecked();
    expect(
      screen.getByRole('button', { name: 'Día y hora, Domingos a las 20:00' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Si pasas un tiempo sin abrir la app, el recordatorio sigue llegando con un mensaje general. Nunca recibes más de uno por semana.',
      ),
    ).toBeOnTheScreen();
  });

  it('goes back', async () => {
    const { onBack } = await setup('granted');
    await ready();

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state while the preferences are read', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.preferences, 'get').mockReturnValue(new Promise(() => undefined));
    await setup('granted', dependencies);

    expect(screen.getByLabelText('Cargando tus recordatorios')).toBeOnTheScreen();
  });

  it('offers a retry when the preferences cannot be read', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.preferences, 'get').mockRejectedValueOnce(new Error('db'));
    await setup('granted', dependencies);

    expect(await screen.findByText('No se pudieron cargar tus recordatorios.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    await ready();
  });

  it('hides "Día y hora" when the weekly switch is off and brings it back with the same values', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await setup('granted');
    await ready();

    await user.press(screen.getByRole('switch', { name: 'Recordatorio semanal' }));

    await waitFor(() => {
      expect(screen.queryByText('Día y hora')).not.toBeOnTheScreen();
    });
    expect(announce).not.toHaveBeenCalled();

    await user.press(screen.getByRole('switch', { name: 'Recordatorio semanal' }));

    expect(
      await screen.findByRole('button', { name: 'Día y hora, Domingos a las 20:00' }),
    ).toBeOnTheScreen();
    expect(announce).not.toHaveBeenCalled();
  });

  it('saves the monthly switch without announcing the success', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { dependencies } = await setup('granted');
    await ready();

    await user.press(screen.getByRole('switch', { name: 'Resumen del mes' }));

    await waitFor(async () => {
      expect((await dependencies.preferences.get()).monthly.enabled).toBe(false);
    });
    expect(announce).not.toHaveBeenCalled();
  });

  it('puts the switch back and shows an error when saving fails', async () => {
    const dependencies = createTestDependencies();
    await setup('granted', dependencies);
    await ready();
    jest.spyOn(dependencies.preferences, 'save').mockRejectedValueOnce(new Error('disk'));

    await user.press(screen.getByRole('switch', { name: 'Resumen del mes' }));

    expect(
      (
        await screen.findAllByText('No se pudo guardar el cambio. Inténtalo de nuevo.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('switch', { name: 'Resumen del mes' })).toBeChecked();
  });

  it('changes the day and time, saves them and reconciles the notices', async () => {
    const { dependencies } = await setup('granted');
    await ready();
    await waitFor(() => {
      expect(dependencies.notifications.scheduledNow().length).toBeGreaterThan(0);
    });

    await user.press(screen.getByRole('button', { name: 'Día y hora, Domingos a las 20:00' }));
    await user.press(screen.getByRole('radio', { name: 'Martes' }));
    await settle(fireEvent.changeText(screen.getByRole('adjustable', { name: 'Hora' }), '8'));
    await user.press(screen.getByRole('radio', { name: '30' }));
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      (
        await screen.findAllByText('Listo, te avisamos los martes a las 8:30.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect((await dependencies.preferences.get()).weekly).toEqual({
      enabled: true,
      weekday: 2,
      minuteOfDay: 510,
    });
    await waitFor(() => {
      const repeat = dependencies.notifications
        .scheduledNow()
        .find(({ identifier }) => identifier === 'cv.weekly.repeat');
      expect(repeat?.kind === 'weekly_reminder' && repeat.trigger).toEqual({
        type: 'weekly',
        weekday: 2,
        minuteOfDay: 510,
      });
    });
    expect(
      await screen.findByRole('button', { name: 'Día y hora, Martes a las 8:30' }),
    ).toBeOnTheScreen();
  });

  it('builds the day and time on what is shown while another change is still saving', async () => {
    const dependencies = createTestDependencies();
    await setup('granted', dependencies);
    await ready();
    const save = jest.spyOn(dependencies.preferences, 'save');
    save.mockImplementationOnce(() => new Promise(() => undefined));

    await user.press(screen.getByRole('switch', { name: 'Resumen del mes' }));
    await user.press(screen.getByRole('button', { name: 'Día y hora, Domingos a las 20:00' }));
    await user.press(screen.getByRole('radio', { name: 'Martes' }));
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(2);
    });
    expect(save.mock.calls[1]?.[0]).toEqual({
      weekly: { enabled: true, weekday: 2, minuteOfDay: 1200 },
      monthly: { enabled: false },
    });
  });

  it('keeps the sheet open and shows an error when saving the day and time fails', async () => {
    const dependencies = createTestDependencies();
    await setup('granted', dependencies);
    await ready();
    jest.spyOn(dependencies.preferences, 'save').mockRejectedValueOnce(new Error('disk'));

    await user.press(screen.getByRole('button', { name: 'Día y hora, Domingos a las 20:00' }));
    await user.press(screen.getByRole('radio', { name: 'Lunes' }));
    await user.press(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      (
        await screen.findAllByText('No se pudo guardar el cambio. Inténtalo de nuevo.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('radio', { name: 'Lunes' })).toBeChecked();
  });

  it('discards the changes when the sheet is closed without saving', async () => {
    const { dependencies } = await setup('granted');
    await ready();

    await user.press(screen.getByRole('button', { name: 'Día y hora, Domingos a las 20:00' }));
    await user.press(screen.getByRole('radio', { name: 'Lunes' }));
    await user.press(firstCloseButton());

    expect((await dependencies.preferences.get()).weekly.weekday).toBe(7);
  });

  describe('permission', () => {
    it('shows nothing about the permission until it is read, then the state', async () => {
      await setup('granted');
      await ready();

      expect(
        await screen.findByText('Los avisos están activados en tu teléfono.'),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/Lo que elijas aquí se guarda/)).not.toBeOnTheScreen();
    });

    it('asks for the permission directly and announces it when granted', async () => {
      const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
      const dependencies = createTestDependencies();
      await setup('undetermined', dependencies);
      await ready();
      jest.spyOn(dependencies.notifications, 'requestPermission').mockImplementation(() => {
        dependencies.notifications.setPermission('granted');
        return Promise.resolve('granted');
      });

      await user.press(await screen.findByRole('button', { name: 'Activar recordatorios' }));

      expect(
        await screen.findByText('Los avisos están activados en tu teléfono.'),
      ).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledWith('Recordatorios activados');
    });

    it('shows the denied state, opens the system settings and never asks again', async () => {
      const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
      const { dependencies } = await setup('denied');
      await ready();

      await user.press(await screen.findByRole('button', { name: 'Abrir ajustes' }));

      expect(openSettings).toHaveBeenCalledTimes(1);
      expect(dependencies.notifications.requestCount).toBe(0);
    });

    it('lets the person edit while the permission is denied and says when it will apply', async () => {
      const { dependencies } = await setup('denied');
      await ready();
      expect(
        await screen.findByText(
          'Lo que elijas aquí se guarda y empieza a funcionar cuando actives los avisos.',
        ),
      ).toBeOnTheScreen();

      await user.press(screen.getByRole('switch', { name: 'Resumen del mes' }));

      await waitFor(async () => {
        expect((await dependencies.preferences.get()).monthly.enabled).toBe(false);
      });
    });
  });

  it('offers the test panel in test builds', async () => {
    await setup('granted');
    await ready();

    expect(screen.getByRole('button', { name: 'Aviso en 1 minuto' })).toBeOnTheScreen();
  });
});
