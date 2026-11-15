/** Quién tiene el lock; sirve para logs y para decidir qué hacer si está ocupado. */
export type FileLockOwner =
  'orphan_collection' | 'photo_removal' | 'backup_export' | 'backup_restore' | 'backup_cleanup';

/** Permiso exclusivo; liberar dos veces no tiene efecto. */
export interface FileLockLease {
  readonly owner: FileLockOwner;
  release(): void;
}

/**
 * Lock en memoria del proceso sobre `photos/` (ADR-008, ADR-012). No es reentrante.
 * Mientras está tomado, la recolección de huérfanos no corre y los borrados de archivos esperan.
 */
export interface FileLock {
  /** Toma el lock si está libre; `null` si está ocupado. */
  tryAcquire(owner: FileLockOwner): FileLockLease | null;
  /** Espera hasta tomar el lock (orden de llegada). */
  acquire(owner: FileLockOwner): Promise<FileLockLease>;
  /** Indica si alguien tiene el lock. */
  isHeld(): boolean;
  /** Ejecuta `task` en cuanto el lock quede libre (de inmediato si ya lo está). Los errores de `task` no rompen la liberación. */
  whenReleased(task: () => void): void;
}
