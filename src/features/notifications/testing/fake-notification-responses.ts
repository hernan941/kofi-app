import type { NotificationResponseSource, NotificationTap } from '../domain/ports';

/** Doble de `NotificationResponseSource` para emitir toques y fijar el último. */
export interface FakeNotificationResponses extends NotificationResponseSource {
  /** Fija lo que devuelve `getLast` (el toque del arranque en frío). */
  setLast(tap: NotificationTap | null): void;
  /** Entrega un toque a los oyentes, como con la app abierta. */
  emit(tap: NotificationTap): void;
  readonly listenerCount: number;
  readonly clearCount: number;
}

/** Toque de prueba con la acción por defecto. */
export function fakeTap(key: string, data: unknown, isDefaultAction = true): NotificationTap {
  return { key, isDefaultAction, data };
}

/** Crea el doble; `clearLast` borra el último, como `clearLastNotificationResponse`. */
export function createFakeNotificationResponses(): FakeNotificationResponses {
  let last: NotificationTap | null = null;
  let clearCount = 0;
  const listeners = new Set<(tap: NotificationTap) => void>();
  return {
    setLast: (tap) => {
      last = tap;
    },
    emit: (tap) => {
      for (const listener of [...listeners]) {
        listener(tap);
      }
    },
    get listenerCount() {
      return listeners.size;
    },
    get clearCount() {
      return clearCount;
    },
    getLast: () => last,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clearLast: () => {
      clearCount += 1;
      last = null;
      return Promise.resolve();
    },
  };
}
