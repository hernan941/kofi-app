import type { ScheduledNotification } from '../domain/diff';
import type { PlannedNotification } from '../domain/plan';
import type { NotificationPermission, NotificationScheduler } from '../domain/ports';

/** Operación registrada por {@link FakeNotificationScheduler}, en el orden en que empezó. */
export type SchedulerOperation =
  | { readonly type: 'permission' }
  | { readonly type: 'list' }
  | { readonly type: 'cancel'; readonly identifiers: readonly string[] }
  | { readonly type: 'schedule'; readonly identifiers: readonly string[] };

type FailableOperation = 'permission' | 'list' | 'cancel' | 'schedule';

/** Opciones de {@link createFakeNotificationScheduler}. */
export interface FakeNotificationSchedulerOptions {
  readonly permission?: NotificationPermission;
  /** Permiso que queda después de `requestPermission`; por defecto, el actual. */
  readonly requestResult?: NotificationPermission;
  /** Cada operación espera a `release` o `releaseAll`, para probar la serialización. */
  readonly isSlow?: boolean;
}

/** Doble de `NotificationScheduler` con registro de operaciones, fallas y modo lento. */
export interface FakeNotificationScheduler extends NotificationScheduler {
  readonly operations: readonly SchedulerOperation[];
  readonly requestCount: number;
  /** Operaciones detenidas esperando `release` (solo con `isSlow`). */
  readonly pendingCount: number;
  /** Estado actual de lo programado, sin registrar una operación. */
  scheduledNow(): readonly ScheduledNotification[];
  setPermission(permission: NotificationPermission): void;
  /** Vacía el registro de operaciones. */
  clearOperations(): void;
  /** Siembra lo programado sin registrar operaciones. */
  seed(notifications: readonly ScheduledNotification[]): void;
  /** La próxima operación de ese tipo rechaza una vez. */
  failNext(operation: FailableOperation): void;
  /** Libera la operación detenida más antigua. */
  release(): void;
  releaseAll(): void;
}

/** Crea el doble; con `isSlow`, cada operación queda detenida hasta liberarla. */
export function createFakeNotificationScheduler({
  permission: initialPermission = 'undetermined',
  requestResult,
  isSlow = false,
}: FakeNotificationSchedulerOptions = {}): FakeNotificationScheduler {
  let permission = initialPermission;
  let requestCount = 0;
  const scheduled = new Map<string, ScheduledNotification>();
  const operations: SchedulerOperation[] = [];
  const failures = new Set<FailableOperation>();
  const gates: (() => void)[] = [];

  const enter = async (operation: SchedulerOperation): Promise<void> => {
    operations.push(operation);
    if (isSlow) {
      await new Promise<void>((resolve) => {
        gates.push(resolve);
      });
    }
    if (failures.delete(operation.type)) {
      throw new Error('fake scheduler failure');
    }
  };

  return {
    operations,
    get requestCount() {
      return requestCount;
    },
    get pendingCount() {
      return gates.length;
    },
    scheduledNow: () => [...scheduled.values()],
    setPermission: (next) => {
      permission = next;
    },
    clearOperations: () => {
      operations.length = 0;
    },
    seed: (notifications) => {
      for (const notification of notifications) {
        scheduled.set(notification.identifier, notification);
      }
    },
    failNext: (operation) => {
      failures.add(operation);
    },
    release: () => {
      gates.shift()?.();
    },
    releaseAll: () => {
      for (const release of gates.splice(0)) {
        release();
      }
    },
    getPermission: async () => {
      await enter({ type: 'permission' });
      return permission;
    },
    requestPermission: () => {
      requestCount += 1;
      permission = requestResult ?? permission;
      return Promise.resolve(permission);
    },
    listScheduled: async () => {
      await enter({ type: 'list' });
      return [...scheduled.values()];
    },
    cancel: async (identifiers) => {
      await enter({ type: 'cancel', identifiers });
      for (const identifier of identifiers) {
        scheduled.delete(identifier);
      }
    },
    schedule: async (notifications: readonly PlannedNotification[]) => {
      await enter({
        type: 'schedule',
        identifiers: notifications.map(({ identifier }) => identifier),
      });
      for (const notification of notifications) {
        scheduled.set(notification.identifier, notification);
      }
    },
  };
}
