import { z } from 'zod';

/** Fixtures de E2E que existen (ADR-013): `basic` para flujos rápidos y `large` para medir. */
export const e2eFixtureNameSchema = z.enum(['basic', 'large']);

/** Nombre de un fixture de E2E. */
export type E2eFixtureName = z.infer<typeof e2eFixtureNameSchema>;

/** Parámetros de la ruta `/e2e/seed`. */
export const seedRouteParamsSchema = z.object({ fixture: e2eFixtureNameSchema });
