import { addDays, weekRangeOf, type LocalDate } from '@/shared/domain';

import type { NoSalesWeekRepository, SaleRepository } from '../data/sale-repository';
import { STREAK_SCAN_WEEKS, registeredWeeks, streakFrom, type Streak } from '../domain';

const DAYS_IN_WEEK = 7;

/** Lecturas que necesita el cargador. */
export interface StreakReadPorts {
  readonly sales: Pick<SaleRepository, 'activeWeekStartsBetween'>;
  readonly noSalesWeeks: Pick<NoSalesWeekRepository, 'listBetween'>;
}

async function readWindow(
  ports: StreakReadPorts,
  from: LocalDate,
  to: LocalDate,
): Promise<ReadonlySet<LocalDate>> {
  const [saleWeekStarts, marks] = await Promise.all([
    ports.sales.activeWeekStartsBetween(from, to),
    ports.noSalesWeeks.listBetween(from, to),
  ]);
  return registeredWeeks(saleWeekStarts, marks);
}

/**
 * Calcula la racha leyendo ventanas de 26 semanas hacia atrás:
 * 1. la primera va desde 25 semanas antes de la actual hasta el domingo de la actual;
 * 2. si la racha llega al primer lunes de la ventana, pide la ventana anterior y repite;
 * 3. si no, termina. Siempre termina: los datos son finitos y una ventana vacía es un hueco.
 *
 * Lee las dos fuentes fuera de una transacción: la invalidación posterior corrige cualquier
 * instante intermedio.
 */
export async function loadStreak(
  ports: StreakReadPorts,
  currentWeekStart: LocalDate,
): Promise<Streak> {
  const span = STREAK_SCAN_WEEKS * DAYS_IN_WEEK;
  let windowStart = addDays(currentWeekStart, -span + DAYS_IN_WEEK);
  const registered = new Set<LocalDate>();
  let windowEnd = weekRangeOf(currentWeekStart).end;
  for (;;) {
    for (const week of await readWindow(ports, windowStart, windowEnd)) {
      registered.add(week);
    }
    const streak = streakFrom(currentWeekStart, registered);
    if (streak.oldestWeekStart !== windowStart) {
      return streak;
    }
    windowEnd = addDays(windowStart, -1);
    windowStart = addDays(windowStart, -span);
  }
}
