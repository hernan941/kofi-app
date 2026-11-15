/** Fase de una exportación de respaldo, para el texto de progreso. */
export type ExportProgress =
  | { readonly phase: 'reading' }
  | { readonly phase: 'hashing_photos'; readonly done: number; readonly total: number }
  | { readonly phase: 'writing'; readonly done: number; readonly total: number }
  | { readonly phase: 'sharing' };

/** Fase de una restauración, para el texto de progreso. */
export type RestoreProgress =
  | { readonly phase: 'validating' }
  | { readonly phase: 'checking_space' }
  | { readonly phase: 'safety_backup'; readonly done: number; readonly total: number }
  | { readonly phase: 'copying_photos'; readonly done: number; readonly total: number }
  | { readonly phase: 'applying' }
  | { readonly phase: 'finishing' };
