import type { BootFailure } from '@/core/db/configure-and-migrate';

/** Estado de una condición del arranque. */
export type BootCondition = 'pending' | 'ready' | 'failed';

/** Fase del arranque; el splash se mantiene mientras no sea `ready` ni `failed`. */
export type BootState =
  | { readonly phase: 'booting' }
  | { readonly phase: 'loading'; readonly fonts: BootCondition; readonly database: BootCondition }
  | { readonly phase: 'ready'; readonly usingSystemFont: boolean }
  | { readonly phase: 'failed'; readonly failure: BootFailure };

/** Eventos que `MigrationGate` traduce desde los efectos. */
export type BootEvent =
  | { readonly type: 'started' }
  | { readonly type: 'fonts_loaded' }
  | { readonly type: 'fonts_failed' }
  | { readonly type: 'database_ready' }
  | { readonly type: 'database_failed'; readonly failure: BootFailure };

type LoadingState = Extract<BootState, { phase: 'loading' }>;

/** Pasa a `ready` si la base está lista y las fuentes ya se resolvieron (bien o mal). */
function settle(state: LoadingState): BootState {
  if (state.database === 'ready' && state.fonts !== 'pending') {
    return { phase: 'ready', usingSystemFont: state.fonts === 'failed' };
  }
  return state;
}

/**
 * Transición pura del arranque. Las fuentes y la base son independientes: un fallo de
 * fuentes no detiene el arranque (se usa la fuente del sistema) y un fallo de la base sí.
 * Los eventos sobre un estado final, o anteriores al inicio, se ignoran.
 */
export function bootReducer(state: BootState, event: BootEvent): BootState {
  if (state.phase === 'booting') {
    return event.type === 'started'
      ? { phase: 'loading', fonts: 'pending', database: 'pending' }
      : state;
  }
  if (state.phase !== 'loading') {
    return state;
  }
  switch (event.type) {
    case 'started':
      return state;
    case 'fonts_loaded':
      return settle({ ...state, fonts: 'ready' });
    case 'fonts_failed':
      return settle({ ...state, fonts: 'failed' });
    case 'database_ready':
      return settle({ ...state, database: 'ready' });
    case 'database_failed':
      return { phase: 'failed', failure: event.failure };
  }
}

/** Indica si ya se puede ocultar el splash. */
export function isBootSettled(state: BootState): boolean {
  return state.phase === 'ready' || state.phase === 'failed';
}
