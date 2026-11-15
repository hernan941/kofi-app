import { act, screen, userEvent } from '@testing-library/react-native';

import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import type { NotificationPermission } from '../domain/ports';
import { PermissionIntroScreen } from './permission-intro-screen';

const user = userEvent.setup();

async function setup(
  result: NotificationPermission = 'granted',
  dependencies: TestDependencies = createTestDependencies(),
) {
  dependencies.notifications.setPermission('undetermined');
  const requestPermission = jest
    .spyOn(dependencies.notifications, 'requestPermission')
    .mockImplementation(() => {
      dependencies.notifications.setPermission(result);
      return Promise.resolve(result);
    });
  const onFinished = jest.fn();
  await renderWithProviders(<PermissionIntroScreen onFinished={onFinished} />, { dependencies });
  return { dependencies, requestPermission, onFinished };
}

describe('PermissionIntroScreen', () => {
  it('explains exactly what will arrive, with the saved day and time', async () => {
    await setup();

    expect(
      screen.getByRole('header', { name: '¿Te recordamos anotar tus ventas?' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Anotar una vez por semana es la forma más simple de saber cuánto vendes.'),
    ).toBeOnTheScreen();
    expect(
      await screen.findByLabelText('Un aviso por semana, los domingos a las 20:00.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('El día 1 de cada mes, tu resumen del mes anterior.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText('Puedes cambiar el día y la hora, o apagarlos, en Ajustes.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Nunca te llega más de un recordatorio por semana.')).toBeOnTheScreen();
  });

  it('shows the generic weekly line while the preferences are read', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.preferences, 'get').mockReturnValue(new Promise(() => undefined));
    await setup('granted', dependencies);

    expect(
      screen.getByLabelText('Un aviso por semana, el día y a la hora que elijas.'),
    ).toBeOnTheScreen();
  });

  it('shows the generic weekly line when the preferences cannot be read', async () => {
    const dependencies = createTestDependencies();
    jest.spyOn(dependencies.preferences, 'get').mockRejectedValue(new Error('db'));
    await setup('granted', dependencies);

    expect(
      await screen.findByLabelText('Un aviso por semana, el día y a la hora que elijas.'),
    ).toBeOnTheScreen();
  });

  it('shows the real day and time of the saved preferences', async () => {
    const dependencies = createTestDependencies();
    await dependencies.preferences.save(
      { weekly: { enabled: true, weekday: 2, minuteOfDay: 510 }, monthly: { enabled: true } },
      dependencies.clock.now(),
    );
    await setup('granted', dependencies);

    expect(
      await screen.findByLabelText('Un aviso por semana, los martes a las 8:30.'),
    ).toBeOnTheScreen();
  });

  it('finishes without asking for the permission or showing anything on "Ahora no"', async () => {
    const { requestPermission, onFinished } = await setup();

    await user.press(screen.getByRole('button', { name: 'Ahora no' }));

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(screen.queryByText(/Listo, te avisamos/)).not.toBeOnTheScreen();
  });

  it('asks for the permission, confirms the day and time and reconciles when granted', async () => {
    const { dependencies, requestPermission, onFinished } = await setup('granted');
    await screen.findByLabelText('Un aviso por semana, los domingos a las 20:00.');

    await user.press(screen.getByRole('button', { name: 'Activar recordatorios' }));

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(
      (
        await screen.findAllByText('Listo, te avisamos los domingos a las 20:00.', {
          includeHiddenElements: true,
        })
      ).length,
    ).toBeGreaterThan(0);
    await screen.findByLabelText('Un aviso por semana, los domingos a las 20:00.');
    expect(dependencies.notifications.operations.map(({ type }) => type)).toContain('list');
  });

  it('finishes without any message when the permission is denied', async () => {
    const { dependencies, onFinished } = await setup('denied');

    await user.press(screen.getByRole('button', { name: 'Activar recordatorios' }));

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Listo, te avisamos/)).not.toBeOnTheScreen();
    expect(dependencies.notifications.scheduledNow()).toEqual([]);
  });

  it('finishes without any message when asking fails', async () => {
    const { requestPermission, onFinished } = await setup();
    requestPermission.mockRejectedValueOnce(new Error('no dialog'));

    await user.press(screen.getByRole('button', { name: 'Activar recordatorios' }));

    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('asks only once when the main button is pressed twice', async () => {
    const { requestPermission, onFinished } = await setup();
    const button = screen.getByRole('button', { name: 'Activar recordatorios' });

    await user.press(button);
    await user.press(button);

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('ignores a second press while the permission dialog is still open', async () => {
    const { requestPermission, onFinished } = await setup();
    let answer: (permission: NotificationPermission) => void = () => undefined;
    requestPermission.mockImplementationOnce(
      () =>
        new Promise<NotificationPermission>((resolve) => {
          answer = resolve;
        }),
    );
    const button = screen.getByRole('button', { name: 'Activar recordatorios' });

    await user.press(button);
    await user.press(button);

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(onFinished).not.toHaveBeenCalled();

    await act(() => {
      answer('granted');
    });

    expect(onFinished).toHaveBeenCalledTimes(1);
  });
});
