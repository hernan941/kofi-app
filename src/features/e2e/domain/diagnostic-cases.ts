import type { LocalCalendar } from '@/shared/domain/calendar/local-calendar';
import { localDateSchema } from '@/shared/domain/calendar/local-date';
import { SANTIAGO_DIAGNOSTIC_CASES } from './santiago-diagnostic-cases';

/** Función de `LocalCalendar` que ejercita un caso. */
export type DiagnosticKind = 'localDateOf' | 'instantAt' | 'nextLocalMidnight';

/** Resultado de un caso: lo esperado según el fixture, lo obtenido y si coinciden. */
export interface DiagnosticRow {
  readonly kind: DiagnosticKind;
  readonly description: string;
  readonly expected: string;
  readonly actual: string;
  readonly passed: boolean;
}

/** Resultado de correr todos los casos del fixture de una zona. */
export interface DiagnosticReport {
  readonly zone: string;
  readonly rows: readonly DiagnosticRow[];
  readonly failures: number;
}

function row(kind: DiagnosticKind, description: string, expected: string, actual: string) {
  return { kind, description, expected, actual, passed: expected === actual };
}

/**
 * Corre contra `calendar` los casos de fecha de `America/Santiago` (ADR-015): `localDateOf`,
 * `instantAt` y `nextLocalMidnight`, incluidos los cambios de hora. En el build E2E se
 * ejecuta en Hermes con el teléfono en esa zona. Es una función pura y no usa `Date`: el
 * calendario llega por parámetro y los instantes son milisegundos epoch; los instantes se
 * muestran como esos milisegundos.
 */
export function runDateDiagnostics(calendar: LocalCalendar): DiagnosticReport {
  const cases = SANTIAGO_DIAGNOSTIC_CASES;
  const rows: DiagnosticRow[] = [
    ...cases.localDates.map(({ label, instant, date }) =>
      row('localDateOf', label, date, calendar.localDateOf(instant)),
    ),
    ...cases.instantAt.map(({ description, date, minuteOfDay, expected }) =>
      row(
        'instantAt',
        description,
        String(expected),
        String(calendar.instantAt(localDateSchema.parse(date), minuteOfDay)),
      ),
    ),
    ...cases.nextMidnight.map(({ description, from, expected }) =>
      row(
        'nextLocalMidnight',
        description,
        String(expected),
        String(calendar.nextLocalMidnight(from)),
      ),
    ),
  ];
  return { zone: cases.zone, rows, failures: rows.filter(({ passed }) => !passed).length };
}
