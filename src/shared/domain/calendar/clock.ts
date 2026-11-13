import { epochMsSchema, type EpochMs } from '../epoch-ms';

/** Fuente del instante actual, reemplazable en tests. */
export interface Clock {
  now(): EpochMs;
}

/** Adaptador real de `Clock` sobre `Date.now()`; el único lugar del dominio que lo usa. */
export const systemClock: Clock = {
  now: () => epochMsSchema.parse(Date.now()),
};
