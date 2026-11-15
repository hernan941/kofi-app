import { weekRangeOf, type Clock, type EpochMs, type LocalCalendar } from '@/shared/domain';
import type { Logger } from '@/shared/lib/logger';

import type { PreferencesRepository } from '../data/preferences-repository';
import { diffNotifications } from '../domain/diff';
import {
  FALLBACK_WEEKS,
  MONTHS_AHEAD,
  planNotifications,
  weeklyInstantToRemember,
  type PlannedNotification,
} from '../domain/plan';
import type { NotificationScheduler, RegisteredWeekReader } from '../domain/ports';
import { weeklyRepeatId } from '../domain/identifiers';

/** Puertos de una ejecución. */
export interface ReconcileDeps {
  readonly scheduler: NotificationScheduler;
  readonly preferences: Pick<
    PreferencesRepository,
    'get' | 'getLastWeeklyFireAt' | 'setLastWeeklyFireAt'
  >;
  readonly weeks: RegisteredWeekReader;
  readonly clock: Clock;
  readonly calendar: LocalCalendar;
  readonly logger: Logger;
}

/** Resumen sin datos del negocio, para el logger. */
export interface ReconcileSummary {
  readonly state: 'A' | 'B' | 'weekly_off' | 'no_permission';
  readonly cancelled: number;
  readonly scheduled: number;
}

/** Estado del plan: A con el semanal repetitivo, B con avisos de una sola vez, o sin semanal. */
function stateOf(plan: readonly PlannedNotification[]): ReconcileSummary['state'] {
  if (plan.some(({ identifier }) => identifier === weeklyRepeatId())) {
    return 'A';
  }
  return plan.some(({ kind }) => kind === 'weekly_reminder') ? 'B' : 'weekly_off';
}

/** Qué hacer con el instante semanal recordado: guardar uno nuevo, borrarlo o dejarlo. */
type WeeklyMemory =
  | { readonly kind: 'keep' }
  | { readonly kind: 'clear' }
  | {
      readonly kind: 'remember';
      readonly instant: EpochMs;
    };

interface BuiltPlan {
  readonly plan: readonly PlannedNotification[];
  readonly hasPermission: boolean;
  readonly weeklyMemory: WeeklyMemory;
}

/** Plan del momento: vacío sin permiso concedido. */
async function buildPlan(deps: ReconcileDeps): Promise<BuiltPlan> {
  const permission = await deps.scheduler.getPermission();
  if (permission !== 'granted') {
    return { plan: [], hasPermission: false, weeklyMemory: { kind: 'keep' } };
  }
  const now = deps.clock.now();
  const preferences = await deps.preferences.get();
  const currentWeekRegistered = preferences.weekly.enabled
    ? await deps.weeks.isRegistered(weekRangeOf(deps.calendar.localDateOf(now)))
    : false;
  const input = {
    now,
    calendar: deps.calendar,
    preferences,
    currentWeekRegistered,
    lastWeeklyFireAt: await deps.preferences.getLastWeeklyFireAt(),
    fallbackWeeks: FALLBACK_WEEKS,
    monthsAhead: MONTHS_AHEAD,
  };
  const instant = weeklyInstantToRemember(input);
  const weeklyMemory: WeeklyMemory = !preferences.weekly.enabled
    ? { kind: 'clear' }
    : instant === null
      ? { kind: 'keep' }
      : { kind: 'remember', instant };
  return { plan: planNotifications(input), hasPermission: true, weeklyMemory };
}

/** Guarda lo que D-13 necesita recordar, después de que el sistema quedó como el plan. */
async function applyWeeklyMemory(deps: ReconcileDeps, memory: WeeklyMemory): Promise<void> {
  if (memory.kind === 'keep') {
    return;
  }
  await deps.preferences.setLastWeeklyFireAt(
    memory.kind === 'clear' ? null : memory.instant,
    deps.clock.now(),
  );
}

/**
 * Una ejecución (ADR-011): permiso, plan, lo programado y solo las diferencias, **siempre
 * cancelando antes de programar** para que, si algo falla a la mitad, pueda faltar un aviso
 * pero nunca sobrar uno. Sin permiso concedido el plan es vacío y se cancela todo lo de la app.
 * Sin diferencias no llama a `cancel` ni a `schedule`.
 */
export async function reconcileNotifications(deps: ReconcileDeps): Promise<ReconcileSummary> {
  const { plan, hasPermission, weeklyMemory } = await buildPlan(deps);
  const scheduled = await deps.scheduler.listScheduled();
  const diff = diffNotifications(plan, scheduled);
  if (diff.toCancel.length > 0) {
    await deps.scheduler.cancel(diff.toCancel);
  }
  if (diff.toSchedule.length > 0) {
    await deps.scheduler.schedule(diff.toSchedule);
  }
  await applyWeeklyMemory(deps, weeklyMemory);
  const summary: ReconcileSummary = {
    state: hasPermission ? stateOf(plan) : 'no_permission',
    cancelled: diff.toCancel.length,
    scheduled: diff.toSchedule.length,
  };
  deps.logger.info('notifications_reconciled', { ...summary });
  return summary;
}
