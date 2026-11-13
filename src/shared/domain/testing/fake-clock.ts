import { epochMsSchema, type EpochMs } from '../epoch-ms';
import type { Clock } from '../calendar/clock';

/** Reloj controlable para tests: solo se mueve con `set` y `advance`. */
export class FakeClock implements Clock {
  private current: EpochMs;

  constructor(start: EpochMs) {
    this.current = start;
  }

  now(): EpochMs {
    return this.current;
  }

  /** Fija el instante actual. */
  set(instant: EpochMs): void {
    this.current = instant;
  }

  /** Avanza el instante actual `ms` milisegundos. */
  advance(ms: number): void {
    this.current = epochMsSchema.parse(this.current + ms);
  }
}
