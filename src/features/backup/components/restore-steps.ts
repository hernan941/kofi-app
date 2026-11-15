import type { RestoreProgress } from '../domain/progress';

/** Paso que ve la persona al restaurar (F8.1, 3.6). */
export type RestoreStep = 'review' | 'safety' | 'photos' | 'apply';

/** Estado de un paso: hecho, en curso o pendiente. */
export type RestoreStepState = 'done' | 'current' | 'pending';

const STEP_ORDER: readonly RestoreStep[] = ['review', 'safety', 'photos', 'apply'];

const STEP_OF_PHASE: Readonly<Record<RestoreProgress['phase'], RestoreStep>> = {
  validating: 'review',
  checking_space: 'review',
  safety_backup: 'safety',
  copying_photos: 'photos',
  applying: 'apply',
  finishing: 'apply',
};

/**
 * Estado de cada paso según la fase de `confirmRestore`. Sin fase todavía, el primero está en
 * curso. Si el respaldo no tiene fotos, el paso "Copiar las fotos" no aparece y su fase (que
 * llega con total 0) pasa directo a "Aplicar los cambios".
 */
export function restoreStepStates(
  progress: RestoreProgress | null,
  hasPhotos: boolean,
): readonly { readonly step: RestoreStep; readonly state: RestoreStepState }[] {
  const steps = STEP_ORDER.filter((step) => hasPhotos || step !== 'photos');
  const phaseStep = progress === null ? 'review' : STEP_OF_PHASE[progress.phase];
  const currentStep = steps.includes(phaseStep) ? phaseStep : 'apply';
  const currentIndex = steps.indexOf(currentStep);
  return steps.map((step, index) => ({
    step,
    state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending',
  }));
}
