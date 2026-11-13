import {
  addDays,
  deterministicId,
  err,
  isoWeekday,
  noSalesWeekIdSchema,
  ok,
  weekRangeOf,
  type LocalDate,
  type NoSalesWeekId,
  type Result,
  type WeekRange,
} from '@/shared/domain';

import type { SaleErrors } from './errors';
import type { NoSalesWeek } from './sale';

const MONDAY = 1;
const TUESDAY = 2;
const DAYS_IN_WEEK = 7;

/** Id determinista de la marca de una semana (ADR-007): UUIDv5 de `weekStart` (texto `YYYY-MM-DD`) con `NAMESPACE_CUANTOVENDI`. */
export function noSalesWeekId(weekStart: LocalDate): NoSalesWeekId {
  return noSalesWeekIdSchema.parse(deterministicId(weekStart));
}

/** Marca de la semana que empieza en `weekStart`; `not_a_week_start` si no es lunes. */
export function noSalesWeekOf(weekStart: LocalDate): Result<NoSalesWeek, SaleErrors> {
  if (isoWeekday(weekStart) !== MONDAY) {
    return err([{ code: 'not_a_week_start', path: ['weekStart'] }]);
  }
  return ok({ id: noSalesWeekId(weekStart), weekStart });
}

/** Lo que se sabe de una semana para decidir. "Tiene ventas" = algún registro activo con al menos un ítem activo. */
export interface WeekFacts {
  readonly week: WeekRange;
  readonly hasSales: boolean;
  readonly isMarked: boolean;
}

/** Estado de una semana para "no vendí". */
export type NoSalesWeekStatus = 'markable' | 'marked' | 'has_sales' | 'not_allowed';

function isMarkableWindow(weekStart: LocalDate, today: LocalDate): boolean {
  const current = weekRangeOf(today).start;
  return weekStart === current || weekStart === addDays(current, -DAYS_IN_WEEK);
}

/** D-18 y D-25: `not_allowed` si no es la semana de `today` ni la anterior; después `has_sales`, `marked` o `markable`. */
export function noSalesWeekStatus(facts: WeekFacts, today: LocalDate): NoSalesWeekStatus {
  if (isoWeekday(facts.week.start) !== MONDAY || !isMarkableWindow(facts.week.start, today)) {
    return 'not_allowed';
  }
  if (facts.hasSales) {
    return 'has_sales';
  }
  return facts.isMarked ? 'marked' : 'markable';
}

/** Lo que muestra el panel de "no vendí". */
export type NoSalesPrompt =
  | { readonly kind: 'single'; readonly week: WeekRange; readonly which: 'current' | 'previous' }
  | {
      readonly kind: 'choose';
      readonly previous: WeekRange;
      readonly current: WeekRange;
      readonly preselected: 'previous';
    }
  | { readonly kind: 'marked'; readonly week: WeekRange }
  | { readonly kind: 'has_sales'; readonly week: WeekRange };

function promptForCurrent(current: WeekFacts): NoSalesPrompt {
  if (current.hasSales) {
    return { kind: 'has_sales', week: current.week };
  }
  return current.isMarked
    ? { kind: 'marked', week: current.week }
    : { kind: 'single', week: current.week, which: 'current' };
}

/**
 * Regla única del panel:
 * 1. Si `isoWeekday(today)` es 1 o 2 y la semana anterior no tiene registro (ni ventas ni marca):
 *    con la actual `markable` es `choose`; con la actual `has_sales` o `marked`, `single` de la anterior.
 * 2. Si no, según el estado de la actual: `single` (`current`), `marked` o `has_sales`.
 * @throws {RangeError} Si `current` no es la semana de `today` o `previous` no es la anterior.
 */
export function noSalesPrompt(
  today: LocalDate,
  current: WeekFacts,
  previous: WeekFacts,
): NoSalesPrompt {
  const currentStart = weekRangeOf(today).start;
  if (
    current.week.start !== currentStart ||
    previous.week.start !== addDays(currentStart, -DAYS_IN_WEEK)
  ) {
    throw new RangeError('The week facts must describe the current and the previous week of today');
  }
  const weekday = isoWeekday(today);
  const previousIsEmpty = !previous.hasSales && !previous.isMarked;
  if ((weekday === MONDAY || weekday === TUESDAY) && previousIsEmpty) {
    if (!current.hasSales && !current.isMarked) {
      return {
        kind: 'choose',
        previous: previous.week,
        current: current.week,
        preselected: 'previous',
      };
    }
    return { kind: 'single', week: previous.week, which: 'previous' };
  }
  return promptForCurrent(current);
}

/** Se puede desmarcar la misma ventana que se puede marcar (D-18): semana actual o anterior. */
export function canUnmarkNoSales(weekStart: LocalDate, today: LocalDate): boolean {
  return isoWeekday(weekStart) === MONDAY && isMarkableWindow(weekStart, today);
}
