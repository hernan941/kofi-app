import { act, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';

import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '../domain';
import type { NotificationPermission } from '../domain/ports';
import { useNotificationPermission } from './use-notification-permission';
import { useNotificationPreferences } from './use-notification-preferences';
import { useRequestNotificationPermission } from './use-request-notification-permission';
import { useSaveNotificationPreferences } from './use-save-notification-preferences';

const TUESDAY_EARLY: NotificationPreferences = {
  weekly: { enabled: true, weekday: 2, minuteOfDay: 510 },
  monthly: { enabled: false },
};

function PreferencesProbe({
  onSave,
}: {
  readonly onSave?: (save: () => Promise<unknown>) => void;
}) {
  const query = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  useEffect(() => {
    onSave?.(() => save.mutateAsync(TUESDAY_EARLY));
  }, [onSave, save]);
  if (query.isPending) {
    return <Text>cargando</Text>;
  }
  return (
    <Text>{`día ${String(query.data?.weekly.weekday)} minuto ${String(query.data?.weekly.minuteOfDay)}`}</Text>
  );
}

function PermissionProbe() {
  const { permission } = useNotificationPermission();
  return <Text>{`permiso ${permission ?? 'sin leer'}`}</Text>;
}

function RequestProbe({
  onRequest,
}: {
  readonly onRequest: (run: () => Promise<unknown>) => void;
}) {
  const { request } = useRequestNotificationPermission();
  useEffect(() => {
    onRequest(request);
  }, [onRequest, request]);
  return null;
}

describe('useNotificationPreferences and useSaveNotificationPreferences', () => {
  it('reads the defaults and shows the saved value after saving', async () => {
    let save: (() => Promise<unknown>) | undefined;
    await renderWithProviders(
      <PreferencesProbe
        onSave={(run) => {
          save = run;
        }}
      />,
      { observeDataChanges: true },
    );
    expect(await screen.findByText('día 7 minuto 1200')).toBeOnTheScreen();

    await act(async () => {
      await save?.();
    });

    expect(await screen.findByText('día 2 minuto 510')).toBeOnTheScreen();
  });

  it('stamps the save with the clock and logs and rethrows a failure', async () => {
    const dependencies = createTestDependencies();
    const saveSpy = jest.spyOn(dependencies.preferences, 'save');
    let save: (() => Promise<unknown>) | undefined;
    await renderWithProviders(
      <PreferencesProbe
        onSave={(run) => {
          save = run;
        }}
      />,
      { dependencies },
    );
    await act(async () => {
      await save?.();
    });
    expect(saveSpy).toHaveBeenCalledWith(TUESDAY_EARLY, dependencies.clock.now());

    saveSpy.mockRejectedValueOnce(new Error('disk'));
    await act(async () => {
      await expect(save?.()).rejects.toThrow('disk');
    });
    expect(dependencies.logger.entriesAt('error').map(({ event }) => event)).toContain(
      'save_notification_preferences_failed',
    );
  });

  it('falls back to the default preferences constant', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.weekly.weekday).toBe(7);
  });
});

describe('useNotificationPermission', () => {
  it('shows nothing until the permission is read, then the permission', async () => {
    const dependencies = createTestDependencies();
    dependencies.notifications.setPermission('denied');

    await renderWithProviders(<PermissionProbe />, { dependencies });

    expect(await screen.findByText('permiso denied')).toBeOnTheScreen();
  });

  it('reads the permission again when the app returns to the foreground', async () => {
    const dependencies = createTestDependencies();
    dependencies.notifications.setPermission('denied');
    const handlers: ((state: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      handlers.push(handler);
      return { remove: jest.fn() };
    });
    await renderWithProviders(<PermissionProbe />, { dependencies });
    await screen.findByText('permiso denied');

    dependencies.notifications.setPermission('granted');
    await act(() => {
      for (const handler of handlers) handler('active');
    });

    expect(await screen.findByText('permiso granted')).toBeOnTheScreen();
  });
});

describe('useRequestNotificationPermission', () => {
  async function setup(result: NotificationPermission) {
    const dependencies = createTestDependencies();
    dependencies.notifications.setPermission('undetermined');
    const requestSpy = jest.spyOn(dependencies.notifications, 'requestPermission');
    requestSpy.mockImplementation(() => {
      dependencies.notifications.setPermission(result);
      return Promise.resolve(result);
    });
    const reconcile = jest.spyOn(dependencies.notificationReconciler, 'request');
    let run: (() => Promise<unknown>) | undefined;
    await renderWithProviders(
      <>
        <PermissionProbe />
        <RequestProbe
          onRequest={(request) => {
            run = request;
          }}
        />
      </>,
      { dependencies },
    );
    await screen.findByText('permiso undetermined');
    return { dependencies, requestSpy, reconcile, run: () => run?.() };
  }

  it('asks the system, reconciles and updates the permission when it is granted', async () => {
    const { run, reconcile } = await setup('granted');

    await act(() => run());

    expect(await screen.findByText('permiso granted')).toBeOnTheScreen();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('does not reconcile when the permission is denied, and shows it', async () => {
    const { run, reconcile } = await setup('denied');

    await act(() => run());

    expect(await screen.findByText('permiso denied')).toBeOnTheScreen();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('asks the system only once when pressed twice while the dialog is open', async () => {
    const { run, requestSpy } = await setup('granted');

    await act(async () => {
      await Promise.all([run(), run()]);
    });

    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('resolves null and logs when the request throws', async () => {
    const { run, requestSpy, dependencies } = await setup('granted');
    requestSpy.mockRejectedValueOnce(new Error('no dialog'));

    let outcome: unknown = 'unset';
    await act(async () => {
      outcome = await run();
    });

    expect(outcome).toBeNull();
    await waitFor(() => {
      expect(dependencies.logger.entriesAt('error').map(({ event }) => event)).toContain(
        'request_notification_permission_failed',
      );
    });
  });
});
