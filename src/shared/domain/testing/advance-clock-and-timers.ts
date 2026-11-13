import type { FakeClock } from './fake-clock';

/**
 * Avanza a la vez el `FakeClock` y los timers falsos de Jest (que debe estar activo con
 * `jest.useFakeTimers()`). El reloj se mueve primero para que los timers que se disparan
 * lean el instante nuevo.
 */
export function advanceClockAndTimers(clock: FakeClock, ms: number): void {
  clock.advance(ms);
  jest.advanceTimersByTime(ms);
}
