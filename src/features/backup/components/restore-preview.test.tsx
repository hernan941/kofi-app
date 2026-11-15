import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { epochMsSchema } from '@/shared/domain';
import { renderUi } from '@/shared/ui/testing/render-ui';

import type { BackupDate } from '../domain/backup-date';
import type { RestorePreview as RestorePreviewData } from '../use-cases/prepare-restore';
import { RestorePreview } from './restore-preview';

const user = userEvent.setup();
const FULL_DATE: BackupDate = { text: '13 de noviembre de 2026, 15:42', isRelative: false };
const TODAY: BackupDate = { text: 'hoy, 15:42', isRelative: true };

function previewOf(overrides: Partial<RestorePreviewData> = {}): RestorePreviewData {
  return {
    createdAt: epochMsSchema.parse(1),
    products: 24,
    saleRecords: 312,
    activePhotos: 40,
    current: { products: 30, saleRecords: 350, activePhotos: 12 },
    ...overrides,
  };
}

async function setUp(props: Partial<Parameters<typeof RestorePreview>[0]> = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  await renderUi(
    <RestorePreview
      preview={previewOf()}
      source="file"
      date={FULL_DATE}
      previousSafetyDate={null}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe('RestorePreview', () => {
  it('asks the question and sums up the backup in one card', async () => {
    await setUp();

    expect(screen.getByRole('header', { name: '¿Restaurar este respaldo?' })).toBeOnTheScreen();
    expect(
      screen.getByLabelText(
        'Respaldo del 13 de noviembre de 2026, 15:42: 24 productos, 312 ventas y 40 fotos',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Productos', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('312', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('says "de hoy" for a backup made today', async () => {
    await setUp({ date: TODAY });

    expect(screen.getByLabelText(/^Respaldo de hoy, 15:42: /)).toBeOnTheScreen();
  });

  it('uses the singular with one', async () => {
    await setUp({ preview: previewOf({ products: 1, saleRecords: 1, activePhotos: 1 }) });

    expect(screen.getByLabelText(/1 producto, 1 venta y 1 foto$/)).toBeOnTheScreen();
  });

  it('shows what the app has today next to what the backup brings', async () => {
    await setUp();

    expect(
      screen.getByText('Hoy tienes 30 productos, 350 ventas y 12 fotos en la app.'),
    ).toBeOnTheScreen();
  });

  it('warns when the backup is empty', async () => {
    await setUp({ preview: previewOf({ products: 0, saleRecords: 0 }) });

    expect(
      screen.getByText(
        'Este respaldo no tiene productos ni ventas. Si lo restauras, la app queda vacía.',
      ),
    ).toBeOnTheScreen();
  });

  it('does not warn when the backup has data', async () => {
    await setUp();

    expect(screen.queryByText(/no tiene productos ni ventas/)).not.toBeOnTheScreen();
  });

  it('explains what will happen, always keeping the reminders', async () => {
    await setUp();

    expect(
      screen.getByText(
        'Todo lo que hay ahora en la app se cambia por lo que tiene este respaldo: productos, fotos y ventas.',
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Antes de empezar, guardamos una copia de seguridad de cómo está la app ahora.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Tus recordatorios se mantienen como están.')).toBeOnTheScreen();
    expect(screen.queryByText(/Reemplaza a la copia/)).not.toBeOnTheScreen();
  });

  it('says which earlier safety copy is replaced', async () => {
    await setUp({
      previousSafetyDate: { text: '10 de noviembre de 2026, 9:05', isRelative: false },
    });

    expect(
      screen.getByText('Reemplaza a la copia del 10 de noviembre de 2026, 9:05.'),
    ).toBeOnTheScreen();
  });

  it('uses the texts of the safety copy', async () => {
    await setUp({ source: 'safety', date: TODAY });

    expect(
      screen.getByRole('header', { name: '¿Volver a la copia de seguridad?' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Copia de hoy, 15:42: /)).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Antes de empezar, guardamos cómo está la app ahora. Esa pasa a ser tu nueva copia de seguridad.',
      ),
    ).toBeOnTheScreen();
  });

  it('cancels from the footer', async () => {
    const { onCancel, onConfirm } = await setUp();

    await user.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('needs a second, explicit confirmation before replacing anything', async () => {
    const { onConfirm } = await setUp();

    await user.press(screen.getByRole('button', { name: 'Reemplazar mis datos' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByText('¿Reemplazar todos tus datos?')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Lo que hay ahora en la app se cambia por el respaldo del 13 de noviembre de 2026, 15:42. Antes guardamos una copia de seguridad.',
      ),
    ).toBeOnTheScreen();
  });

  it('says "por el respaldo de hoy" and, for the safety copy, "por la copia del"', async () => {
    await setUp({ date: TODAY });
    await user.press(screen.getByRole('button', { name: 'Reemplazar mis datos' }));
    expect(
      await screen.findByText(
        'Lo que hay ahora en la app se cambia por el respaldo de hoy, 15:42. Antes guardamos una copia de seguridad.',
      ),
    ).toBeOnTheScreen();
  });

  it('describes the safety copy in the dialog', async () => {
    await setUp({ source: 'safety' });

    await user.press(screen.getByRole('button', { name: 'Reemplazar mis datos' }));

    expect(
      await screen.findByText(
        'Lo que hay ahora en la app se cambia por la copia del 13 de noviembre de 2026, 15:42.',
      ),
    ).toBeOnTheScreen();
  });

  it('replaces only when the dialog is confirmed', async () => {
    const { onConfirm } = await setUp();
    await user.press(screen.getByRole('button', { name: 'Reemplazar mis datos' }));

    await user.press(await screen.findByRole('button', { name: 'Sí, reemplazar' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('goes back to the preview when the dialog is cancelled', async () => {
    const { onConfirm, onCancel } = await setUp();
    await user.press(screen.getByRole('button', { name: 'Reemplazar mis datos' }));
    await screen.findByText('¿Reemplazar todos tus datos?');

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancelar' });
    const dialogCancel = cancelButtons.at(-1);
    if (dialogCancel === undefined) throw new Error('No cancel button.');
    await user.press(dialogCancel);

    await waitFor(() => {
      expect(screen.queryByText('¿Reemplazar todos tus datos?')).not.toBeOnTheScreen();
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reemplazar mis datos' })).toBeOnTheScreen();
  });
});
