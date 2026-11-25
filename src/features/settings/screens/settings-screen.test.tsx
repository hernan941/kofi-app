import { screen, userEvent, within } from '@testing-library/react-native';

import { createTestDependencies } from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { findGuiltPattern } from '@/shared/lib/testing/guilt-patterns';
import type { NotificationPermission } from '@/features/notifications';
import { epochMsSchema } from '@/shared/domain';

import { SettingsScreen } from './settings-screen';

const user = userEvent.setup();

function noop() {
  return undefined;
}

async function renderScreen(
  callbacks: Partial<Parameters<typeof SettingsScreen>[0]> = {},
  dependencies = createTestDependencies(),
) {
  await renderWithProviders(
    <SettingsScreen
      onOpenNotifications={noop}
      onOpenBackup={noop}
      onOpenLicenses={noop}
      {...callbacks}
    />,
    { dependencies },
  );
  return dependencies;
}

function withPermission(permission: NotificationPermission) {
  const dependencies = createTestDependencies();
  dependencies.notifications.setPermission(permission);
  return dependencies;
}

describe('SettingsScreen', () => {
  it('has exactly three headings: the title, Privacidad and Acerca de', async () => {
    await renderScreen();

    expect(screen.getAllByRole('header').map((header) => String(header.props.children))).toEqual([
      'Ajustes',
      'Privacidad',
      'Acerca de',
    ]);
  });

  it('lists Recordatorios first and Respaldo y planillas second', async () => {
    await renderScreen();

    const buttons = screen.getAllByRole('button');

    expect(buttons[0]).toHaveProp('accessibilityLabel', expect.stringMatching(/^Recordatorios/));
    expect(buttons[1]).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/^Respaldo y planillas/),
    );
  });

  it('has exactly three buttons, each with its hint', async () => {
    await renderScreen();

    const buttons = screen.getAllByRole('button');

    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => String(button.props.accessibilityHint))).toEqual([
      'Cambia el día, la hora o apaga los avisos',
      'Crea un respaldo, exporta planillas o vuelve a una copia',
      'Abre la lista de licencias',
    ]);
  });

  describe('reminders summary', () => {
    it('is only the title while it loads', async () => {
      await renderScreen();

      expect(screen.getByRole('button', { name: 'Recordatorios' })).toBeOnTheScreen();
    });

    it.each([
      ['granted', 'Recordatorios, Domingos a las 20:00 y resumen del mes'],
      ['undetermined', 'Recordatorios, Los avisos están sin activar'],
      ['denied', 'Recordatorios, Los avisos están apagados en tu teléfono'],
    ] as const)('with the permission %s reads "%s"', async (permission, label) => {
      await renderScreen({}, withPermission(permission));

      expect(await screen.findByRole('button', { name: label })).toBeOnTheScreen();
    });

    it('stays a pressable row without a subtitle when the permission cannot be read', async () => {
      const onOpenNotifications = jest.fn();
      const dependencies = createTestDependencies();
      dependencies.notifications.failNext('permission');
      await renderScreen({ onOpenNotifications }, dependencies);

      await user.press(screen.getByRole('button', { name: 'Recordatorios' }));

      expect(onOpenNotifications).toHaveBeenCalledTimes(1);
    });

    it('opens the reminders', async () => {
      const onOpenNotifications = jest.fn();
      await renderScreen({ onOpenNotifications });

      await user.press(screen.getByRole('button', { name: /^Recordatorios/ }));

      expect(onOpenNotifications).toHaveBeenCalledTimes(1);
    });
  });

  describe('backup summary', () => {
    it('suggests saving the data when there is no safety copy', async () => {
      await renderScreen();

      expect(
        await screen.findByRole('button', {
          name: 'Respaldo y planillas, Guarda tus datos o expórtalos en planillas',
        }),
      ).toBeOnTheScreen();
    });

    it("mentions today's safety copy with its time", async () => {
      const dependencies = createTestDependencies();
      dependencies.backupFiles.safety = {
        uri: 'file:///fake/doc/safety/a.zip',
        createdAt: epochMsSchema.parse(dependencies.clock.now()),
      };
      await renderScreen({}, dependencies);

      expect(
        await screen.findByRole('button', {
          name: /^Respaldo y planillas, Tienes una copia de seguridad de hoy, \d{1,2}:\d{2}$/,
        }),
      ).toBeOnTheScreen();
    });

    it('keeps the phrase without a copy and a pressable row when reading the copy fails', async () => {
      const onOpenBackup = jest.fn();
      const dependencies = createTestDependencies();
      jest.spyOn(dependencies.backupFiles, 'latestSafety').mockImplementation(() => {
        throw new Error('The folder cannot be read.');
      });
      await renderScreen({ onOpenBackup }, dependencies);

      await user.press(
        await screen.findByRole('button', { name: /^Respaldo y planillas, Guarda/ }),
      );

      expect(onOpenBackup).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the privacy note without blaming the person', async () => {
    await renderScreen();

    const note = screen.getByLabelText(/^Tus datos viven en tu teléfono/);

    expect(within(note).getByText(/no envía nada a internet/)).toBeOnTheScreen();
    expect(findGuiltPattern(note.props.accessibilityLabel as string)).toBeNull();
  });

  it('shows the name and the version of the app', async () => {
    await renderScreen();

    expect(screen.getByLabelText('Kofi, Versión 1.0.0-test')).toBeOnTheScreen();
  });

  it('shows only the name when the version is unknown', async () => {
    await renderScreen({}, createTestDependencies({ appVersion: 'unknown' }));

    expect(screen.getByLabelText('Kofi')).toBeOnTheScreen();
    expect(screen.queryByText(/^Versión/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/unknown/)).not.toBeOnTheScreen();
  });

  it('opens the third-party licenses', async () => {
    const onOpenLicenses = jest.fn();
    await renderScreen({ onOpenLicenses });

    await user.press(
      screen.getByRole('button', {
        name: 'Licencias de terceros, Bibliotecas de código abierto que usa la app',
      }),
    );

    expect(onOpenLicenses).toHaveBeenCalledTimes(1);
  });

  it('opens the backup', async () => {
    const onOpenBackup = jest.fn();
    await renderScreen({ onOpenBackup });

    await user.press(await screen.findByRole('button', { name: /^Respaldo y planillas/ }));

    expect(onOpenBackup).toHaveBeenCalledTimes(1);
  });
});
