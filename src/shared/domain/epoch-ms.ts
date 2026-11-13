import { z } from 'zod';

/** Instante en milisegundos epoch UTC; fuente única de `EpochMs`. */
export const epochMsSchema = z.number().int().nonnegative().brand<'EpochMs'>();

/** Instante en milisegundos desde epoch UTC. */
export type EpochMs = z.infer<typeof epochMsSchema>;
