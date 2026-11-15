import { screen, userEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import type { ExportBackupState } from '../hooks/use-export-backup';
import type { ExportCsvState } from '../hooks/use-export-csv';
import { BackupActions, type BackupActionsProps } from './backup-actions';

const user = userEvent.setup();
const SAFETY_DATE = { text: '10 de noviembre de 2026, 9:05', isRelative: false } as const;

function handlers() {
  return {
    onCreateBackup: jest.fn(),
    onExportCsv: jest.fn(),
    onPickFile: jest.fn(),
    onRestoreSafety: jest.fn(),
  };
}

async function setUp(props: Partial<BackupActionsProps> = {}) {
  const callbacks = handlers();
  await renderUi(
    <BackupActions
      backup={{ status: 'idle' }}
      csv={{ status: 'idle' }}
      inspecting={null}
      safetyDate={null}
      {...callbacks}
      {...props}
    />,
  );
  return callbacks;
}

describe('BackupActions', () => {
  it('shows the sections with their headings in order', async () => {
    await setUp();

    expect(
      screen.getAllByRole('header').map((heading) => heading.props.children as string),
    ).toEqual([
      'Respaldo de tus datos',
      'Ventas y productos en planillas',
      'Restaurar un respaldo',
    ]);
    expect(
      screen.getByText(
        'Guarda en un archivo todo lo que tienes en la app: productos, fotos y ventas. Guárdalo en tu correo, en Drive o donde prefieras.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('El archivo no lleva contraseña. Guárdalo en un lugar que solo uses tú.'),
    ).toBeOnTheScreen();
  });

  it('starts each action from its button', async () => {
    const { onCreateBackup, onExportCsv, onPickFile } = await setUp();

    await user.press(screen.getByRole('button', { name: 'Crear respaldo' }));
    await user.press(screen.getByRole('button', { name: 'Exportar ventas' }));
    await user.press(screen.getByRole('button', { name: 'Exportar productos' }));
    await user.press(screen.getByRole('button', { name: 'Elegir un respaldo' }));

    expect(onCreateBackup).toHaveBeenCalledTimes(1);
    expect(onExportCsv.mock.calls).toEqual([['sales'], ['products']]);
    expect(onPickFile).toHaveBeenCalledTimes(1);
  });

  it('hides the safety copy section when there is none', async () => {
    await setUp();

    expect(screen.queryByText('Copia de seguridad')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Restaurar esta copia' })).not.toBeOnTheScreen();
  });

  it('shows the safety copy with its date and restores it', async () => {
    const { onRestoreSafety } = await setUp({ safetyDate: SAFETY_DATE });

    expect(screen.getByRole('header', { name: 'Copia de seguridad' })).toBeOnTheScreen();
    expect(screen.getByText('Copia del 10 de noviembre de 2026, 9:05')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Restaurar esta copia' }));

    expect(onRestoreSafety).toHaveBeenCalledTimes(1);
  });

  it('shows "de hoy" for a safety copy made today', async () => {
    await setUp({ safetyDate: { text: 'hoy, 15:42', isRelative: true } });

    expect(screen.getByText('Copia de hoy, 15:42')).toBeOnTheScreen();
  });

  it.each([
    [{ phase: 'reading' }, 'Leyendo tus datos…'],
    [{ phase: 'hashing_photos', done: 3, total: 10 }, 'Revisando tus fotos: 3 de 10'],
    [{ phase: 'writing', done: 2, total: 12 }, 'Creando el archivo: 2 de 12'],
    [{ phase: 'sharing' }, 'Abriendo el menú para compartir…'],
  ] as const)('replaces the button with the progress of %j', async (progress, label) => {
    await setUp({ backup: { status: 'working', progress } });

    expect(screen.getByRole('progressbar', { name: label })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Crear respaldo' })).not.toBeOnTheScreen();
  });

  it('disables the other actions while the backup is created', async () => {
    await setUp({ backup: { status: 'working', progress: { phase: 'reading' } } });

    for (const name of ['Exportar ventas', 'Exportar productos', 'Elegir un respaldo']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('announces the phase without numbers', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    await setUp({
      backup: { status: 'working', progress: { phase: 'writing', done: 1, total: 9 } },
    });

    expect(announce).toHaveBeenCalledWith('Creando el archivo…');
  });

  it.each([
    ['sales', 'Preparando la planilla de ventas…', 'Exportar productos'],
    ['products', 'Preparando la planilla de productos…', 'Exportar ventas'],
  ] as const)(
    'shows the progress of the %s sheet in place of its button',
    async (kind, label, other) => {
      await setUp({ csv: { status: 'working', kind } });

      expect(screen.getByRole('progressbar', { name: label })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: other })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Crear respaldo' })).toBeEnabled();
    },
  );

  it('hides the button of the sheet being prepared and keeps the other one', async () => {
    await setUp({ csv: { status: 'working', kind: 'sales' } });

    expect(screen.queryByRole('button', { name: 'Exportar ventas' })).not.toBeOnTheScreen();
  });

  it('shows the file review in the restore section and disables the rest', async () => {
    await setUp({ inspecting: 'file' });

    expect(screen.getByRole('progressbar', { name: 'Revisando el archivo…' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Crear respaldo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Exportar ventas' })).toBeDisabled();
  });

  it('shows the review of the safety copy in its own section', async () => {
    await setUp({ inspecting: 'safety', safetyDate: SAFETY_DATE });

    expect(screen.getByRole('progressbar', { name: 'Revisando la copia…' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Elegir un respaldo' })).toBeDisabled();
  });

  it('shows the problem of the backup under its section', async () => {
    const backup: ExportBackupState = {
      status: 'failed',
      problem: { code: 'not_enough_space', requiredBytes: 350_000_000 },
    };

    await setUp({ backup });

    expect(
      screen.getByText(
        'No hay espacio suficiente para crear el respaldo. Libera al menos 350 MB y vuelve a intentarlo.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Crear respaldo' })).toBeOnTheScreen();
  });

  it('announces the problem', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    await setUp({ backup: { status: 'failed', problem: 'unexpected' } });

    expect(announce).toHaveBeenCalledWith('No se pudo crear el respaldo. Inténtalo de nuevo.');
  });

  it('shows the problem of a sheet under the sheet buttons', async () => {
    const csv: ExportCsvState = { status: 'failed', kind: 'products', problem: 'unexpected' };

    await setUp({ csv });

    expect(screen.getByText('No se pudo crear la planilla. Inténtalo de nuevo.')).toBeOnTheScreen();
  });

  it.each([
    ['a sheet is being prepared', { csv: { status: 'working', kind: 'sales' } }],
    ['a file is being reviewed', { inspecting: 'file' }],
  ] as const)('does not start a backup, and says to wait, while %s', async (_name, props) => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { onCreateBackup } = await setUp(props);

    await user.press(screen.getByRole('button', { name: 'Crear respaldo' }));

    expect(onCreateBackup).not.toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith('Espera a que termine.');
  });
});
