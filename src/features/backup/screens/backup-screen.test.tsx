import { act, screen, userEvent, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import {
  createTestDependencies,
  type TestDependencies,
} from '@/core/testing/create-test-dependencies';
import { renderWithProviders } from '@/core/testing/render-with-providers';
import { epochMsSchema } from '@/shared/domain';

import { buildBackupArchive } from '../testing/backup-archive-builder';
import {
  EMPTY_SNAPSHOT,
  itemRow,
  productRow,
  recordRow,
  versionRow,
} from '../testing/snapshot-fixtures';
import type { DatabaseSnapshot } from '../domain/snapshot';
import { BackupScreen } from './backup-screen';

type PreventRemoveCallback = (options: { data: { action: unknown }; repeat: () => void }) => void;
const mockPreventRemove = jest.fn<unknown, [prevent: boolean, callback: PreventRemoveCallback]>();
jest.mock('expo-router', () => ({
  usePreventRemove: (prevent: boolean, callback: PreventRemoveCallback) => {
    mockPreventRemove(prevent, callback);
  },
}));

const user = userEvent.setup();
const PICKED = 'file:///fake/cache/DocumentPicker/respaldo.zip';
const SNAPSHOT: DatabaseSnapshot = {
  ...EMPTY_SNAPSHOT,
  products: [productRow(1)],
  productVersions: [versionRow(1, 1)],
  saleRecords: [recordRow(1)],
  saleItems: [itemRow(1, 1, 1, 1)],
};

function isPrevented(): boolean {
  return mockPreventRemove.mock.calls.at(-1)?.[0] ?? false;
}

async function tryToLeave() {
  await act(() => {
    mockPreventRemove.mock.calls.at(-1)?.[1]({ data: { action: {} }, repeat: jest.fn() });
  });
}

async function setUp(dependencies: TestDependencies = createTestDependencies()) {
  const replaceAll = jest.fn<Promise<void>, [DatabaseSnapshot]>(() => Promise.resolve());
  const withStore = createTestDependencies({
    ...dependencies,
    backupStore: {
      readSnapshot: () => Promise.resolve(EMPTY_SNAPSHOT),
      countActive: () => Promise.resolve({ products: 0, saleRecords: 0, activePhotos: 0 }),
      replaceAll,
    },
  });
  withStore.archiveIo.put(PICKED, await buildBackupArchive({ snapshot: SNAPSHOT }));
  withStore.documentPicker.picked = { uri: PICKED, name: 'respaldo.zip', size: 10 };
  const onBack = jest.fn();
  const onGoHome = jest.fn();
  await renderWithProviders(<BackupScreen onBack={onBack} onGoHome={onGoHome} />, {
    dependencies: withStore,
  });
  return { dependencies: withStore, replaceAll, onBack, onGoHome };
}

async function openPreview() {
  await user.press(screen.getByRole('button', { name: 'Elegir un respaldo' }));
  await screen.findByRole('header', { name: '¿Restaurar este respaldo?' });
}

describe('BackupScreen', () => {
  it('shows its title, the sections and goes back', async () => {
    const { onBack } = await setUp();

    expect(screen.getByRole('header', { name: 'Respaldo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Crear respaldo' })).toBeOnTheScreen();
    expect(screen.queryByText('Copia de seguridad')).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows the safety copy section with its date', async () => {
    const dependencies = createTestDependencies();
    dependencies.backupFiles.safety = {
      uri: 'file:///fake/doc/safety/a.zip',
      createdAt: epochMsSchema.parse(Date.parse('2026-07-01T16:00:00Z') - 3 * 86_400_000),
    };

    await setUp(dependencies);

    expect(await screen.findByRole('header', { name: 'Copia de seguridad' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Restaurar esta copia' })).toBeOnTheScreen();
  });

  it('reads the safety folder once, not on every render', async () => {
    const dependencies = createTestDependencies();
    const latestSafety = jest.spyOn(dependencies.backupFiles, 'latestSafety');
    await setUp(dependencies);
    await screen.findByRole('button', { name: 'Crear respaldo' });

    await openPreview();
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));
    await user.press(await screen.findByRole('button', { name: 'Crear respaldo' }));

    expect(latestSafety).toHaveBeenCalledTimes(1);
  });

  it('creates a backup, opens the share sheet and says it is done', async () => {
    const { dependencies } = await setUp();

    await user.press(screen.getByRole('button', { name: 'Crear respaldo' }));

    expect(
      (await screen.findAllByText('Respaldo creado', { includeHiddenElements: true })).length,
    ).toBeGreaterThan(0);
    expect(dependencies.fileSharer.shared).toHaveLength(1);
  });

  it('blocks leaving while the backup is created and announces why', async () => {
    const dependencies = createTestDependencies();
    let release: () => void = () => undefined;
    jest.spyOn(dependencies.fileLock, 'acquire').mockReturnValue(
      new Promise(() => {
        release = () => undefined;
      }),
    );
    await setUp(dependencies);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    await user.press(screen.getByRole('button', { name: 'Crear respaldo' }));

    expect(
      await screen.findByRole('progressbar', { name: 'Leyendo tus datos…' }),
    ).toBeOnTheScreen();
    expect(isPrevented()).toBe(true);
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeOnTheScreen();
    await tryToLeave();
    expect(announce).toHaveBeenCalledWith('Espera a que termine.');
    release();
  });

  it('shows the problem of the backup in its section', async () => {
    const dependencies = createTestDependencies();
    dependencies.fileSharer.available = false;
    await setUp(dependencies);

    await user.press(screen.getByRole('button', { name: 'Crear respaldo' }));

    expect(
      await screen.findByText(
        'Tu teléfono no permite compartir archivos desde la app. Revisa que tengas una app para guardarlos, como Drive o Correo.',
      ),
    ).toBeOnTheScreen();
  });

  it('exports the sales sheet even without sales', async () => {
    const { dependencies } = await setUp();

    await user.press(screen.getByRole('button', { name: 'Exportar ventas' }));

    expect(
      (await screen.findAllByText('Planilla de ventas lista', { includeHiddenElements: true }))
        .length,
    ).toBeGreaterThan(0);
    expect(dependencies.fileSharer.shared[0]).toMatchObject({ mimeType: 'text/csv' });
  });

  it('shows nothing when the file picker is cancelled', async () => {
    const dependencies = createTestDependencies();
    await setUp(dependencies);
    dependencies.documentPicker.picked = null;

    await user.press(screen.getByRole('button', { name: 'Elegir un respaldo' }));

    await waitFor(() => {
      expect(dependencies.documentPicker.requests).toHaveLength(1);
    });
    expect(screen.getByRole('header', { name: 'Respaldo' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Restaurar' })).not.toBeOnTheScreen();
    expect(screen.queryByText(/No pudimos/)).not.toBeOnTheScreen();
  });

  it('shows a kind message when the file is not a backup and goes back to the start', async () => {
    const dependencies = createTestDependencies();
    await setUp(dependencies);
    dependencies.archiveIo.put(PICKED, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));

    await user.press(screen.getByRole('button', { name: 'Elegir un respaldo' }));

    expect(
      await screen.findByRole('header', { name: 'Este archivo no es un respaldo de cuantovendi' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Elegir otro archivo' })).toBeOnTheScreen();
    const footerButton = screen.getAllByRole('button', { name: 'Volver' }).at(-1);
    if (footerButton === undefined) throw new Error('No "Volver" button.');
    await user.press(footerButton);

    expect(await screen.findByRole('button', { name: 'Crear respaldo' })).toBeOnTheScreen();
  });

  it('shows the preview and goes back to the start on Cancelar, discarding the file', async () => {
    const { dependencies } = await setUp();

    await openPreview();
    expect(screen.getByText('Hoy la app no tiene productos, ventas ni fotos.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('button', { name: 'Crear respaldo' })).toBeOnTheScreen();
    expect(dependencies.backupFiles.discarded).toContain(PICKED);
  });

  it('treats leaving from the preview as Cancelar', async () => {
    await setUp();
    await openPreview();

    expect(isPrevented()).toBe(true);
    await tryToLeave();

    expect(await screen.findByRole('button', { name: 'Crear respaldo' })).toBeOnTheScreen();
  });

  it('does not replace anything until the dialog is confirmed', async () => {
    const { replaceAll } = await setUp();
    await openPreview();

    await user.press(screen.getByRole('button', { name: 'Reemplazar mis datos' }));

    expect(await screen.findByText('¿Reemplazar todos tus datos?')).toBeOnTheScreen();
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it('restores, shows the success and goes home', async () => {
    const { replaceAll, onGoHome } = await setUp();
    await openPreview();
    await user.press(screen.getByRole('button', { name: 'Reemplazar mis datos' }));

    await user.press(await screen.findByRole('button', { name: 'Sí, reemplazar' }));

    expect(
      await screen.findByRole('header', { name: 'Listo, restauramos tu respaldo' }),
    ).toBeOnTheScreen();
    expect(replaceAll).toHaveBeenCalledTimes(1);
    expect(isPrevented()).toBe(false);
    await user.press(screen.getByRole('button', { name: 'Ir al inicio' }));

    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it('shows the steps and blocks leaving while restoring', async () => {
    const dependencies = createTestDependencies();
    const { replaceAll } = await setUp(dependencies);
    let release: () => void = () => undefined;
    replaceAll.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    await openPreview();
    await user.press(screen.getByRole('button', { name: 'Reemplazar mis datos' }));
    await user.press(await screen.findByRole('button', { name: 'Sí, reemplazar' }));

    expect(
      await screen.findByRole('header', { name: 'Restaurando tu respaldo' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Aplicar los cambios' })).toBeOnTheScreen();
    expect(isPrevented()).toBe(true);
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeOnTheScreen();
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await screen.findByRole('header', { name: 'Listo, restauramos tu respaldo' });
  });

  it('says the data stay as they were when applying fails', async () => {
    const { replaceAll } = await setUp();
    replaceAll.mockRejectedValue(new Error('disk full'));
    await openPreview();
    await user.press(screen.getByRole('button', { name: 'Reemplazar mis datos' }));

    await user.press(await screen.findByRole('button', { name: 'Sí, reemplazar' }));

    expect(await screen.findByRole('header', { name: 'No pudimos terminar' })).toBeOnTheScreen();
    expect(screen.getByText('Tus datos siguen como estaban.')).toBeOnTheScreen();
  });

  it('restores the safety copy with its own texts', async () => {
    const dependencies = createTestDependencies();
    const safetyUri = 'file:///fake/doc/safety/cuantovendi-seguridad-1800000000123.zip';
    dependencies.backupFiles.safety = {
      uri: safetyUri,
      createdAt: epochMsSchema.parse(Date.parse('2026-07-01T10:00:00Z')),
    };
    dependencies.archiveIo.put(safetyUri, await buildBackupArchive({ snapshot: SNAPSHOT }));
    await setUp(dependencies);

    await user.press(await screen.findByRole('button', { name: 'Restaurar esta copia' }));

    expect(
      await screen.findByRole('header', { name: '¿Volver a la copia de seguridad?' }),
    ).toBeOnTheScreen();
  });
});
