import type { RestoreProgress } from '../domain/progress';
import type { RestoreProblem } from '../domain/errors';
import type { RestorePlan, RestorePreview } from '../use-cases/prepare-restore';

/** De dónde sale el respaldo que se restaura: un archivo elegido o la copia de seguridad. */
export type RestoreSource = 'file' | 'safety';

/** Estado de la restauración que ve la pantalla (F8.0, 4.8). */
export type RestoreFlowState =
  | { readonly status: 'idle' }
  | { readonly status: 'picking' }
  | { readonly status: 'inspecting'; readonly source: RestoreSource }
  | { readonly status: 'preview'; readonly source: RestoreSource; readonly plan: RestorePlan }
  | {
      readonly status: 'restoring';
      readonly source: RestoreSource;
      readonly plan: RestorePlan;
      readonly progress: RestoreProgress | null;
    }
  | { readonly status: 'done'; readonly source: RestoreSource; readonly preview: RestorePreview }
  | {
      readonly status: 'failed';
      readonly source: RestoreSource;
      readonly problem: RestoreProblem;
      readonly afterConfirm: boolean;
    };

/** Eventos del reducer {@link restoreFlow}. */
export type RestoreFlowEvent =
  | { readonly type: 'pick' }
  | { readonly type: 'pickCancelled' }
  | { readonly type: 'inspect'; readonly source: RestoreSource }
  | { readonly type: 'inspected'; readonly plan: RestorePlan }
  | { readonly type: 'inspectFailed'; readonly problem: RestoreProblem }
  | { readonly type: 'discard' }
  | { readonly type: 'confirm' }
  | { readonly type: 'progress'; readonly progress: RestoreProgress }
  | { readonly type: 'restored' }
  | { readonly type: 'restoreFailed'; readonly problem: RestoreProblem }
  | { readonly type: 'reset' };

/** Estado inicial: ninguna restauración en curso. */
export const INITIAL_RESTORE_FLOW: RestoreFlowState = { status: 'idle' };

/**
 * Reducer puro de la restauración: `idle → picking → inspecting → preview → restoring → done |
 * failed`. Cancelar el selector vuelve a `idle` sin error. Un evento que no corresponde al
 * estado se ignora (devuelve el mismo estado).
 */
export function restoreFlow(state: RestoreFlowState, event: RestoreFlowEvent): RestoreFlowState {
  switch (event.type) {
    case 'pick':
      return state.status === 'idle' || (state.status === 'failed' && state.source === 'file')
        ? { status: 'picking' }
        : state;
    case 'pickCancelled':
      return state.status === 'picking' ? { status: 'idle' } : state;
    case 'inspect':
      return (event.source === 'file' && state.status === 'picking') ||
        (event.source === 'safety' && state.status === 'idle')
        ? { status: 'inspecting', source: event.source }
        : state;
    case 'inspected':
      return state.status === 'inspecting'
        ? { status: 'preview', source: state.source, plan: event.plan }
        : state;
    case 'inspectFailed':
      return state.status === 'inspecting' || state.status === 'picking'
        ? {
            status: 'failed',
            source: state.status === 'inspecting' ? state.source : 'file',
            problem: event.problem,
            afterConfirm: false,
          }
        : state;
    case 'discard':
      return state.status === 'preview' ? { status: 'idle' } : state;
    case 'confirm':
      return state.status === 'preview'
        ? { status: 'restoring', source: state.source, plan: state.plan, progress: null }
        : state;
    case 'progress':
      return state.status === 'restoring' ? { ...state, progress: event.progress } : state;
    case 'restored':
      return state.status === 'restoring'
        ? { status: 'done', source: state.source, preview: state.plan.preview }
        : state;
    case 'restoreFailed':
      return state.status === 'restoring'
        ? { status: 'failed', source: state.source, problem: event.problem, afterConfirm: true }
        : state;
    case 'reset':
      return state.status === 'failed' || state.status === 'done' ? { status: 'idle' } : state;
  }
}
