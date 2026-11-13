import { epochMsSchema, type EpochMs } from '@/shared/domain/epoch-ms';

/** Caso de `localDateOf`: el instante (con su ISO UTC como etiqueta) y la fecha local esperada. */
export interface LocalDateDiagnosticCase {
  readonly label: string;
  readonly instant: EpochMs;
  readonly date: string;
}

/** Caso de `instantAt`: hora de pared local y el instante esperado. */
export interface InstantAtDiagnosticCase {
  readonly description: string;
  readonly date: string;
  readonly minuteOfDay: number;
  readonly expected: EpochMs;
}

/** Caso de `nextLocalMidnight`: instante de partida y la próxima medianoche esperada. */
export interface NextMidnightDiagnosticCase {
  readonly description: string;
  readonly from: EpochMs;
  readonly expected: EpochMs;
}

/** Casos de una zona para el diagnóstico de fechas. */
export interface DiagnosticCases {
  readonly zone: string;
  readonly localDates: readonly LocalDateDiagnosticCase[];
  readonly instantAt: readonly InstantAtDiagnosticCase[];
  readonly nextMidnight: readonly NextMidnightDiagnosticCase[];
}

const epoch = (value: number): EpochMs => epochMsSchema.parse(value);

/**
 * Casos de `America/Santiago` que corre el diagnóstico de fechas (ADR-015). Los instantes
 * son milisegundos epoch literales para que el dominio no use `Date`; las pruebas verifican
 * que coinciden con el fixture de `shared/domain/calendar`.
 */
export const SANTIAGO_DIAGNOSTIC_CASES: DiagnosticCases = {
  zone: 'America/Santiago',
  localDates: [
    { label: '2026-07-02T03:30:00Z', instant: epoch(1782963000000), date: '2026-07-01' },
    { label: '2026-07-01T04:00:00Z', instant: epoch(1782878400000), date: '2026-07-01' },
    { label: '2026-01-15T02:59:00Z', instant: epoch(1768445940000), date: '2026-01-14' },
    { label: '2026-01-15T03:00:00Z', instant: epoch(1768446000000), date: '2026-01-15' },
    { label: '2026-09-06T04:00:00Z', instant: epoch(1788667200000), date: '2026-09-06' },
    { label: '2026-04-05T02:30:00Z', instant: epoch(1775356200000), date: '2026-04-04' },
    { label: '2026-04-05T03:30:00Z', instant: epoch(1775359800000), date: '2026-04-04' },
  ],
  instantAt: [
    {
      description: 'winter noon',
      date: '2026-07-01',
      minuteOfDay: 720,
      expected: epoch(1782921600000),
    },
    {
      description: 'summer noon',
      date: '2026-01-15',
      minuteOfDay: 720,
      expected: epoch(1768489200000),
    },
    {
      description: 'nonexistent 00:00',
      date: '2026-09-06',
      minuteOfDay: 0,
      expected: epoch(1788667200000),
    },
    {
      description: 'nonexistent 00:30',
      date: '2026-09-06',
      minuteOfDay: 30,
      expected: epoch(1788667200000),
    },
    {
      description: 'first valid minute',
      date: '2026-09-06',
      minuteOfDay: 60,
      expected: epoch(1788667200000),
    },
    {
      description: 'minute after the gap',
      date: '2026-09-06',
      minuteOfDay: 61,
      expected: epoch(1788667260000),
    },
    {
      description: 'repeated 23:00',
      date: '2026-04-04',
      minuteOfDay: 1380,
      expected: epoch(1775354400000),
    },
    {
      description: 'repeated 23:30',
      date: '2026-04-04',
      minuteOfDay: 1410,
      expected: epoch(1775356200000),
    },
    {
      description: 'repeated 23:59',
      date: '2026-04-04',
      minuteOfDay: 1439,
      expected: epoch(1775357940000),
    },
    {
      description: 'midnight after the repeat',
      date: '2026-04-05',
      minuteOfDay: 0,
      expected: epoch(1775361600000),
    },
  ],
  nextMidnight: [
    {
      description: 'before the forward jump',
      from: epoch(1788620400000),
      expected: epoch(1788667200000),
    },
    {
      description: 'before the backward jump',
      from: epoch(1775314800000),
      expected: epoch(1775361600000),
    },
    { description: 'first 23:30', from: epoch(1775356200000), expected: epoch(1775361600000) },
    { description: 'second 23:30', from: epoch(1775359800000), expected: epoch(1775361600000) },
    {
      description: 'exactly at midnight',
      from: epoch(1782878400000),
      expected: epoch(1782964800000),
    },
  ],
};
