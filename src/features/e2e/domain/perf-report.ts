import type { PerfMarkRecord } from '@/shared/lib/perf-marks';

/** Tiempos nativos del arranque (`performance.rnStartupTiming`), en milisegundos. */
export interface StartupTiming {
  readonly startTime: number;
  readonly initializeRuntimeStart: number;
  readonly executeJavaScriptBundleEntryPointStart: number;
  readonly endTime: number;
}

/** Memoria del heap de Hermes (`performance.memory`), en bytes. */
export interface HeapInfo {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
}

/** Lo que muestra la ruta `e2e/perf`. */
export interface PerfReportInput {
  readonly marks: readonly PerfMarkRecord[];
  readonly startup: StartupTiming | null;
  readonly heap: HeapInfo | null;
}

const NO_DETAIL = '-';
const EMPTY_REPORT = 'sin marcas';

function ms(value: number): string {
  return value.toFixed(1);
}

/**
 * Texto plano de las marcas, una línea por dato, que `tools/perf/parse-marks.js` procesa:
 * `mark <nombre> <detalle|-> <ms>`, `startup k=v ...` y `heap used=<bytes> total=<bytes>`.
 */
export function formatPerfReport({ marks, startup, heap }: PerfReportInput): string {
  const lines = marks.map(
    ({ name, detail, atMs }) => `mark ${name} ${detail ?? NO_DETAIL} ${ms(atMs)}`,
  );
  if (startup !== null) {
    lines.push(
      `startup startTime=${ms(startup.startTime)} initializeRuntimeStart=${ms(startup.initializeRuntimeStart)} executeJavaScriptBundleEntryPointStart=${ms(startup.executeJavaScriptBundleEntryPointStart)} endTime=${ms(startup.endTime)}`,
    );
  }
  if (heap !== null) {
    lines.push(`heap used=${String(heap.usedJSHeapSize)} total=${String(heap.totalJSHeapSize)}`);
  }
  return lines.length === 0 ? EMPTY_REPORT : lines.join('\n');
}
