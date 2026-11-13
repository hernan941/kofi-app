import type { z } from 'zod';

import { err, ok, type Result } from '@/shared/domain/result';

/** Error al validar los parámetros de una ruta. */
export type RouteParamsError =
  | { readonly code: 'missing'; readonly param: string }
  | { readonly code: 'repeated'; readonly param: string }
  | { readonly code: 'invalid'; readonly param: string };

/** Parámetros tal como los entrega Expo Router. */
export type RawRouteParams = Readonly<Record<string, string | readonly string[] | undefined>>;

/** Primer parámetro repetido (arreglo), si lo hay. */
function findRepeatedParam(params: RawRouteParams): string | undefined {
  return Object.keys(params).find((name) => Array.isArray(params[name]));
}

/** Quita los parámetros sin valor para que Zod los vea como ausentes. */
function withoutUndefined(params: RawRouteParams): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}

/**
 * Valida los parámetros de Expo Router con un esquema Zod (ADR-010). Rechaza los parámetros
 * repetidos (arreglos) en vez de elegir uno. Nunca lanza: la ruta decide si muestra
 * `NotFoundScreen` o redirige.
 */
export function parseRouteParams<S extends z.ZodType>(
  schema: S,
  params: RawRouteParams,
): Result<z.output<S>, RouteParamsError> {
  const repeated = findRepeatedParam(params);
  if (repeated !== undefined) {
    return err({ code: 'repeated', param: repeated });
  }
  const present = withoutUndefined(params);
  try {
    const parsed = schema.safeParse(present);
    if (parsed.success) {
      return ok(parsed.data);
    }
    const param = String(parsed.error.issues[0]?.path[0] ?? '');
    return err({ code: param in present ? 'invalid' : 'missing', param });
  } catch {
    return err({ code: 'invalid', param: '' });
  }
}
