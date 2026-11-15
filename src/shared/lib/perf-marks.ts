/**
 * Nombre de una marca de rendimiento (P1 a P4 de `docs/architecture/performance-budgets.md`).
 * El detalle opcional distingue el caso, por ejemplo el mes de `calendar:month:*`.
 */
export type PerfMarkName =
  | 'boot:migrate:start'
  | 'boot:migrate:end'
  | 'home:ready'
  | 'sale-form:press'
  | 'sale-form:ready'
  | 'sale:save:press'
  | 'sale:celebration:visible'
  | 'tab:press'
  | 'calendar:ready'
  | 'calendar:month:press'
  | 'calendar:month:ready'
  | 'products:ready';

/** Una marca registrada: `atMs` es el `performance.now()` de Hermes, desde el origen del proceso. */
export interface PerfMarkRecord {
  readonly name: PerfMarkName;
  readonly detail: string | undefined;
  readonly atMs: number;
}

const records: PerfMarkRecord[] = [];

/**
 * Registra una marca de rendimiento y la envía a `performance.mark`. Solo actúa en el build
 * `e2e` (ADR-013, ADR-016): en el `release` Metro reemplaza `process.env.EXPO_PUBLIC_E2E` y
 * pliega el bloque. Los lugares que llaman repiten la misma condición en línea para que los
 * nombres tampoco queden en el bundle.
 */
export function perfMark(name: PerfMarkName, detail?: string): void {
  if (process.env.EXPO_PUBLIC_E2E === '1') {
    const mark = performance.mark(name, detail === undefined ? undefined : { detail });
    records.push({ name, detail, atMs: mark.startTime });
  }
}

/** Marcas registradas desde el arranque, en el orden en que ocurrieron. */
export function readPerfMarks(): readonly PerfMarkRecord[] {
  return [...records];
}

/** Olvida las marcas registradas (para empezar un escenario limpio). */
export function clearPerfMarks(): void {
  records.length = 0;
}
