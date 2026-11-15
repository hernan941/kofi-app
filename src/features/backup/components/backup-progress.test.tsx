import { screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { renderUi } from '@/shared/ui/testing/render-ui';

import type { RestoreProgress } from '../domain/progress';
import { BackupProgress } from './backup-progress';

async function setUp(
  progress: RestoreProgress | null,
  options: { hasPhotos?: boolean; source?: 'file' | 'safety' } = {},
) {
  await renderUi(
    <BackupProgress
      progress={progress}
      hasPhotos={options.hasPhotos ?? true}
      source={options.source ?? 'file'}
    />,
  );
}

describe('BackupProgress', () => {
  it('says what is happening and that the data stay as they were if the app closes', async () => {
    await setUp(null);

    expect(screen.getByRole('header', { name: 'Restaurando tu respaldo' })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Puede tardar un poco si tienes muchas fotos. Si la app se cierra antes de terminar, tus datos se quedan como estaban.',
      ),
    ).toBeOnTheScreen();
  });

  it('uses the title of the safety copy', async () => {
    await setUp(null, { source: 'safety' });

    expect(
      screen.getByRole('header', { name: 'Volviendo a la copia de seguridad' }),
    ).toBeOnTheScreen();
  });

  it('lists the steps and shows the first one in progress at the start', async () => {
    await setUp(null);

    expect(screen.getByRole('progressbar', { name: 'Revisar el respaldo' })).toBeBusy();
    expect(screen.getByText('Guardar la copia de seguridad')).toBeOnTheScreen();
    expect(screen.getByText('Copiar las fotos')).toBeOnTheScreen();
    expect(screen.getByText('Aplicar los cambios')).toBeOnTheScreen();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('shows the photo count as the value of the bar of the photos step', async () => {
    await setUp({ phase: 'copying_photos', done: 12, total: 40 });

    expect(screen.getByRole('progressbar', { name: '12 de 40 fotos' })).toHaveAccessibilityValue({
      min: 0,
      max: 40,
      now: 12,
      text: '12 de 40 fotos',
    });
    expect(screen.getByText('Copiar las fotos')).toBeOnTheScreen();
  });

  it('gives the safety copy step a bar without numbers', async () => {
    await setUp({ phase: 'safety_backup', done: 1, total: 4 });

    const bar = screen.getByRole('progressbar', { name: 'Guardar la copia de seguridad' });
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 4, now: 1 });
  });

  it('marks the steps already done and leaves out the photos when there are none', async () => {
    await setUp({ phase: 'applying' }, { hasPhotos: false });

    expect(screen.queryByText('Copiar las fotos')).not.toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Aplicar los cambios' })).toBeBusy();
    expect(screen.getByLabelText('Revisar el respaldo, hecho')).toBeOnTheScreen();
  });

  it('says "pendiente" for the steps that have not started', async () => {
    await setUp(null);

    expect(screen.getByLabelText('Copiar las fotos, pendiente')).toBeOnTheScreen();
  });

  it('hides the marker of the step in progress with the three attributes', async () => {
    await setUp(null);

    const marker = screen.getAllByTestId('step-marker-spinner', { includeHiddenElements: true })[0];

    expect(marker).toHaveProp('accessible', false);
    expect(marker).toHaveProp('accessibilityElementsHidden', true);
    expect(marker).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('announces each step once, never each photo', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await setUp({ phase: 'copying_photos', done: 1, total: 40 });
    await setUp({ phase: 'copying_photos', done: 2, total: 40 });

    expect(announce.mock.calls.filter(([text]) => text === 'Copiar las fotos')).toHaveLength(2);
    expect(announce).not.toHaveBeenCalledWith('2 de 40 fotos');
  });
});
